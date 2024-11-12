import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Alert,
} from "react-native";
import Mapbox, { Images, LocationPuck, offlineManager } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { supabase } from "./supabase";
import {
  Feather,
  Fontisto,
  FontAwesome6,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { ScreenWidth } from "react-native-elements/dist/helpers";
import colors from "../constants/colors";
import Fuse from "fuse.js";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";
import { useOfflineMap } from "./offlineMapHandler";

// // Initialize Mapbox
// Mapbox.setAccessToken(
//   "pk.eyJ1IjoiZmFmYTMzIiwiYSI6ImNtMGY0OTMwejB3a3Iya3F2ODZhajFnZncifQ.HDHHl3WzIPy2fI-aB1b2Sw"
// );

const VENDORS_STORAGE_KEY = "VENDORS_DATA";
const { width, height } = Dimensions.get("window");

const NearbyVendors1 = () => {
  const navigation = useNavigation();
  const [userLocation, setUserLocation] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [originalVendors, setOriginalVendors] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(23);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [isFollowingUser, setIsFollowingUser] = useState(true); // Par défaut, la caméra suit l'utilisateur
  const [isSorted, setIsSorted] = useState(false); // Nouveau drapeau pour indiquer si la liste est triée
  const [distance, setDistance] = useState("");
  const [userLoc, setUserLoc] = useState(null);
  const [vendorLoc, setVendorLoc] = useState(null);

  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const { checkAndInitializeOfflineMap } = useOfflineMap();
  const [isOfflineMapAvailable, setIsOfflineMapAvailable] = useState(false);

  useEffect(() => {
    const checkOfflinePack = async () => {
      try {
        const packs = await offlineManager.getPacks();
        const offlinePack = packs.find(
          (pack) => pack.name === "BENIN_OFFLINE_MAP"
        );

        if (offlinePack) {
          const status = await offlinePack.status();
          if (status.percentage === 100) {
            setIsOfflineMapAvailable(true);
            console.log("Pack hors ligne trouvé et prêt à être utilisé.");
          } else {
            Alert.alert(
              "Carte hors ligne incomplète",
              "Le téléchargement de la carte n'est pas terminé. Veuillez vérifier votre connexion et réessayer."
            );
          }
        } else {
          Alert.alert(
            "Carte hors ligne manquante",
            "Aucune carte hors ligne n'a été trouvée. Assurez-vous de la télécharger avant d'utiliser cette fonctionnalité."
          );
        }
      } catch (error) {
        console.error(
          "Erreur lors de la vérification du pack hors ligne:",
          error
        );
      }
    };

    checkOfflinePack();
  }, []);

  useEffect(() => {
    checkAndInitializeOfflineMap().then(() => setIsMapReady(true));
  }, []);

  useEffect(() => {
    if (cameraRef.current && userLocation) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation[0], userLocation[1]],
        zoomLevel: zoomLevel,
        animationDuration: 500,
      });
    }
  }, [zoomLevel]); // Re-render à chaque changement de zoomLevel

  const sortVendorsByDistance = () => {
    if (userLocation && vendors.length > 0 && !isSorted) {
      // Vérifier si la liste n'est pas déjà triée
      const sortedVendors = [...vendors].sort((a, b) => {
        const distanceA = haversineDistance(userLocation, [
          a.longitude,
          a.latitude,
        ]);
        const distanceB = haversineDistance(userLocation, [
          b.longitude,
          b.latitude,
        ]);
        return distanceA - distanceB; // Trie par distance croissante
      });
      setVendors(sortedVendors); // Mettre à jour la liste des vendeurs triés
      setIsSorted(true); // Marquer que la liste est triée pour éviter les tris répétés
    }
  };

  useEffect(() => {
    if (userLocation && vendors.length > 0) {
      // Vérifier si la liste n'est pas triée
      setIsSorted(false);
      sortVendorsByDistance();
    }
  }, [userLocation, vendors]);

  useEffect(() => {
    let locationSubscription;

    const setupLocationAndData = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "L'accès à la localisation est nécessaire."
          );
          return;
        }

        // Abonnement à la localisation de l'utilisateur
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            const newUserLocation = [
              location.coords.longitude,
              location.coords.latitude,
            ];
            if (
              userLocation === null ||
              newUserLocation[0] !== userLocation[0] ||
              newUserLocation[1] !== userLocation[1]
            ) {
              setUserLocation(newUserLocation);
            }
          }
        );

        await fetchVendors(); // Récupérer les vendeurs
        setIsSorted(false);
      } catch (error) {
        console.error(
          "Erreur lors de la configuration de la localisation et des données:",
          error
        );
      }
    };

    setupLocationAndData();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []); // Exécuter seulement une fois au montage

  const haversineDistance = (coords1, coords2) => {
    const toRad = (value) => (value * Math.PI) / 180; // Convertir degrés en radians

    const lat1 = coords1[1]; // Latitude du premier point
    const lon1 = coords1[0]; // Longitude du premier point
    const lat2 = coords2[1]; // Latitude du second point
    const lon2 = coords2[0]; // Longitude du second point

    const R = 6371.0088; // Rayon moyen de la Terre en kilomètres

    // Différences de latitude et de longitude en radians
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    // Formule Haversine
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distance finale en kilomètres
    return R * c;
  };

  const fetchVendors = async () => {
    try {
      // Charger les vendeurs mis en cache depuis AsyncStorage
      const cachedVendors = await AsyncStorage.getItem(VENDORS_STORAGE_KEY);
      if (cachedVendors !== null) {
        const parsedVendors = JSON.parse(cachedVendors);
        setVendors(parsedVendors);
        setOriginalVendors(parsedVendors);
        console.log("Vendeurs chargés depuis AsyncStorage");
      } else {
        console.log("Aucun vendeur mis en cache trouvé");
      }

      // Récupérer les données fraîches depuis Supabase
      let { data, error } = await supabase.from("vendors").select("*");
      if (error) {
        console.error(
          "Erreur lors de la récupération des vendeurs depuis Supabase:",
          error
        );
      } else {
        // Filtrer et convertir les coordonnées en nombre
        const vendorsWithValidCoordinates = data
          .filter((vendor) => vendor.longitude && vendor.latitude)
          .map((vendor) => ({
            ...vendor,
            longitude: parseFloat(vendor.longitude),
            latitude: parseFloat(vendor.latitude),
          }));

        // Trier les vendeurs en fonction de leur distance par rapport à la localisation de l'utilisateur
        if (userLocation) {
          const sortedVendors = vendorsWithValidCoordinates.sort((a, b) => {
            const distanceA = haversineDistance(userLocation, [
              a.longitude,
              a.latitude,
            ]);
            const distanceB = haversineDistance(userLocation, [
              b.longitude,
              b.latitude,
            ]);
            return distanceA - distanceB;
          });

          // Mettre à jour l'état avec les vendeurs triés
          setVendors(sortedVendors);
          setOriginalVendors(sortedVendors);

          // Sauvegarder les données triées dans AsyncStorage
          await AsyncStorage.setItem(
            VENDORS_STORAGE_KEY,
            JSON.stringify(sortedVendors)
          );
          console.log(
            "Vendeurs récupérés, triés et mis en cache depuis Supabase"
          );
        } else {
          // Si pas de localisation, sauvegarder sans tri
          setVendors(vendorsWithValidCoordinates);
          setOriginalVendors(vendorsWithValidCoordinates);
          await AsyncStorage.setItem(
            VENDORS_STORAGE_KEY,
            JSON.stringify(vendorsWithValidCoordinates)
          );
          console.log("Vendeurs récupérés sans tri et mis en cache");
        }
      }
    } catch (err) {
      console.error("Erreur dans fetchVendors:", err);
    }
  };

  const handleSupabaseChange = async (payload) => {
    try {
      let updatedVendors = [...vendors];

      if (payload.eventType === "INSERT") {
        const newVendor = {
          ...payload.new,
          longitude: parseFloat(payload.new.longitude),
          latitude: parseFloat(payload.new.latitude),
        };
        updatedVendors.push(newVendor);
      } else if (payload.eventType === "UPDATE") {
        updatedVendors = updatedVendors.map((vendor) =>
          vendor.id === payload.new.id
            ? {
                ...payload.new,
                longitude: parseFloat(payload.new.longitude),
                latitude: parseFloat(payload.new.latitude),
              }
            : vendor
        );
      } else if (payload.eventType === "DELETE") {
        updatedVendors = updatedVendors.filter(
          (vendor) => vendor.id !== payload.old.id
        );
      }

      setVendors(updatedVendors);
      setOriginalVendors(updatedVendors);

      // Mettre à jour AsyncStorage avec la nouvelle liste de vendeurs
      await AsyncStorage.setItem(
        VENDORS_STORAGE_KEY,
        JSON.stringify(updatedVendors)
      );
      console.log(
        "Données des vendeurs mises à jour et mises en cache après changement Supabase"
      );
    } catch (error) {
      console.error("Erreur lors de la gestion du changement Supabase:", error);
    }
  };

  const fuse = new Fuse(vendors, {
    keys: ["name", "lieu", "brands"],
    threshold: 0.3,
  });

  const handleSearch = () => {
    if (searchQuery === "") {
      setVendors(originalVendors);
      return;
    } else {
      const results = fuse.search(searchQuery);
      const filteredVendors = results.map((result) => result.item);
      setVendors(filteredVendors);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setVendors(originalVendors);
  };

  const handleVendorPress = (vendorId) => {
    const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
    if (selectedVendor) {
      setSelectedVendor(selectedVendor);

      // Désactiver le suivi de l'utilisateur pour recentrer la carte sur le vendeur
      setIsFollowingUser(false);

      // Centrer la caméra sur le vendeur sélectionné
      cameraRef.current?.setCamera({
        centerCoordinate: [selectedVendor.longitude, selectedVendor.latitude],
        zoomLevel: 15,
        animationDuration: 1000,
        animationMode: "flyTo",
      });

      // Scroll to the vendor in the list (facultatif)
      const vendorIndex = vendors.findIndex((vendor) => vendor.id === vendorId);
      scrollViewRef.current?.scrollTo({
        x: vendorIndex * (ScreenWidth * 0.9 + 10),
        animated: true,
      });

      // Obtenir les directions si nécessaire
      if (userLocation) {
        getDirections(userLocation, [
          selectedVendor.longitude,
          selectedVendor.latitude,
        ]);
      }
    }
  };

  const handleVendorPress1 = (vendorId) => {
    const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
    if (selectedVendor) {
      setSelectedVendor(selectedVendor);
      console.log(selectedVendor.imageurls[0]);
      setModalVisible(true);
      mapRef.current?.setCamera({
        centerCoordinate: [selectedVendor.longitude, selectedVendor.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });

      const vendorIndex = vendors.findIndex((vendor) => vendor.id === vendorId);
      scrollViewRef.current.scrollTo({
        x: vendorIndex * (ScreenWidth * 0.9 + 10),
        animated: true,
      });

      getDirections(userLocation, [
        selectedVendor.longitude,
        selectedVendor.latitude,
      ]);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedVendor(null);
  };

  const handleOrder = (brand, type, price, distance, userLoc, vendorLoc) => {
    console.log(
      "Order placed: ",
      brand,
      type,
      price,
      distance,
      userLoc,
      vendorLoc
    );
    navigation.navigate("Checkout", {
      vendor: selectedVendor,
      product: { brand, type, price, distance, userLoc, vendorLoc },
    });

    setModalVisible(false);
  };

  const getDirections = async (start, end) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}`,
        {
          params: {
            access_token:
              "pk.eyJ1IjoiZmFmYTMzIiwiYSI6ImNtMGY0OTMwejB3a3Iya3F2ODZhajFnZncifQ.HDHHl3WzIPy2fI-aB1b2Sw",
            geometries: "geojson",
            overview: "full",
            annotations: "maxspeed",
          },
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        setRouteCoordinates(response.data.routes[0].geometry.coordinates);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des directions:", error);
      Alert.alert(
        "Erreur",
        "Impossible de récupérer les directions. Veuillez réessayer."
      );
    }
  };

  const lineLayerStyle = {
    lineColor: "#9ca4f1",
    lineWidth: 9,
  };

  const handleZoom = (direction) => {
    const newZoomLevel = direction === "in" ? zoomLevel + 1 : zoomLevel - 1;

    // Limiter le zoom entre 14 et 20
    const constrainedZoom = Math.min(Math.max(newZoomLevel, 14), 23);

    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation[0], userLocation[1]],
        zoomLevel: constrainedZoom,
        animationDuration: 300,
        animationMode: "easeTo",
      });
      setZoomLevel(constrainedZoom);
      setIsFollowingUser(false); // Désactiver le suivi utilisateur pendant le zoom manuel
    }
  };

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un vendeur..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text === "") {
              handleClearSearch();
            }
          }}
          clearButtonMode="always"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Feather name="search" size={width * 0.06} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.scrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ref={scrollViewRef}
        >
          {vendors.map((vendor) => {
            // Calculer la distance ici
            const distnce = userLocation
              ? haversineDistance(userLocation, [
                  vendor.longitude,
                  vendor.latitude,
                ])
              : 0;

            return (
              <TouchableOpacity
                key={vendor.id}
                onPress={() => {
                  handleVendorPress(vendor.id);
                  setDistance(
                    haversineDistance(userLocation, [
                      vendor.longitude,
                      vendor.latitude,
                    ])
                  );
                }}
                activeOpacity={0.9}
              >
                <View style={{ ...styles.vendorCard, alignItems: "center" }}>
                  <Image
                    source={{ uri: vendor.imageurls[0] }}
                    style={styles.vendorImage}
                  />
                  <View
                    style={{
                      padding: width * 0.025,
                      flexDirection: "column",
                      paddingVertical: height * 0.025,
                      flexGrow: 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", flexGrow: 1 }}>
                      <Fontisto
                        name="shopping-store"
                        size={width * 0.04}
                        color={colors.secondary}
                        style={{ marginRight: width * 0.02 }}
                      />
                      <Text
                        style={{
                          color: colors.title,
                          fontSize: width * 0.04,
                          fontWeight: "bold",
                        }}
                      >
                        {vendor.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        paddingTop: height * 0.01,
                      }}
                    >
                      <FontAwesome6
                        name="map-pin"
                        size={width * 0.04}
                        color={colors.secondary}
                        style={{ marginRight: width * 0.02 }}
                      />
                      <Text
                        style={{ color: colors.title, fontSize: width * 0.035 }}
                      >
                        {vendor.lieu.slice(0, 15) +
                          (vendor.lieu.length > 15 ? "..." : "")}
                      </Text>
                    </View>
                    {/* Ajouter la distance ici */}
                    <View
                      style={{
                        flexDirection: "row",
                        paddingTop: height * 0.01,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="map-marker-distance"
                        size={width * 0.06}
                        color={colors.secondary}
                        style={{ marginRight: width * 0.02 }}
                      />
                      {userLocation && (
                        <Text
                          style={{
                            color: colors.title,
                            fontSize: width * 0.035,
                          }}
                        >
                          {distnce < 1
                            ? (distnce * 1000).toFixed(0) + " m" // Afficher en mètres
                            : distnce.toFixed(2) + " km"}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleVendorPress1(vendor.id)}
                  >
                    <View
                      style={{
                        ...styles.markerIcon,
                        backgroundColor: colors.primary,
                        borderRadius: 50,
                        width: width * 0.1,
                        height: width * 0.1,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Feather name="send" size={width * 0.05} color="white" />
                    </View>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {userLocation && isMapReady && isOfflineMapAvailable ? (
        <Mapbox.MapView
          style={styles.map}
          styleURL="mapbox://styles/mapbox/streets-v11"
          logoEnabled={false}
          offlineEnabled={true}
          localizeLabels={true}
          onDidFinishLoadingMap={() => console.log("Map chargée")}
        >
          {/* <Mapbox.Camera
            ref={cameraRef}
            zoomLevel={zoomLevel}
            centerCoordinate={userLocation}
            followUserLocation={isFollowingUser} // Utilise isFollowingUser pour activer ou désactiver le suivi
            followUserMode="compass"
            onZoomChanged={(zoom) => setZoomLevel(zoom)}
            maxZoomLevel={18}
            minZoomLevel={16}
          /> */}
          <Mapbox.Camera
            ref={cameraRef}
            zoomLevel={zoomLevel}
            centerCoordinate={userLocation}
            followUserLocation={isFollowingUser}
            followUserMode="compass"
            animationMode="moveTo"
            animationDuration={300}
            maxZoomLevel={23}
            minZoomLevel={14}
          />

          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
          {vendors.map((vendor) => (
            <Mapbox.MarkerView
              key={vendor.id}
              id={`marker-${vendor.id}`}
              coordinate={[vendor.longitude, vendor.latitude]}
            >
              <TouchableOpacity
                onPress={() => {
                  handleVendorPress(vendor.id);
                  setDistance(
                    haversineDistance(userLocation, [
                      vendor.longitude,
                      vendor.latitude,
                    ])
                  );
                }}
              >
                <View style={styles.markerContainer}>
                  <Image
                    source={require("../../assets/marker.png")}
                    style={styles.markerImage}
                  />
                </View>
              </TouchableOpacity>
            </Mapbox.MarkerView>
          ))}
          {routeCoordinates && (
            <Mapbox.ShapeSource
              id="routeSource"
              shape={{
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: routeCoordinates,
                },
              }}
            >
              <Mapbox.LineLayer id="routeLayer" style={lineLayerStyle} />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text>Chargement de la carte hors ligne...</Text>
        </View>
      )}

      {selectedVendor && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Feather name="x" size={width * 0.06} color="black" />
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingTop: height * 0.025,
                }}
              >
                <Image
                  source={{ uri: selectedVendor.imageurls[0] }}
                  style={styles.modalImage}
                />
                <Text style={styles.modalTitle}>{selectedVendor.name}</Text>
              </View>
              <Text
                style={{
                  color: colors.title,
                  fontSize: width * 0.045,
                  fontWeight: "bold",
                  marginTop: height * 0.02,
                }}
              >
                Marques disponibles:
              </Text>
              {selectedVendor.brands.map((brand) => (
                <View key={brand} style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: width * 0.045,
                      marginVertical: height * 0.01,
                      textTransform: "capitalize",
                      textDecorationLine: "underline",
                    }}
                  >
                    {brand}
                  </Text>
                  {selectedVendor.bottleTypes[brand].map((type) => (
                    <View
                      key={type}
                      style={{
                        flexDirection: "row",
                        paddingBottom: height * 0.01,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.title,
                          fontSize: width * 0.04,
                          fontWeight: "bold",
                          marginHorizontal: width * 0.02,
                          padding: height * 0.01,
                        }}
                      >
                        {type}:
                      </Text>
                      {selectedVendor.prices[brand][type] && (
                        <Text
                          style={{
                            color: colors.title,
                            fontSize: width * 0.04,
                            padding: height * 0.01,
                          }}
                        >
                          {selectedVendor.prices[brand][type]} XOF
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={async () => {
                          const calculatedDistance = haversineDistance(
                            userLocation,
                            [selectedVendor.longitude, selectedVendor.latitude]
                          );
                          console.log(
                            "Calculated Distance:",
                            calculatedDistance
                          );
                          handleOrder(
                            brand,
                            type,
                            selectedVendor.prices[brand][type],
                            calculatedDistance,
                            {
                              latitude: userLocation[1],
                              longitude: userLocation[0],
                            },
                            {
                              latitude: selectedVendor.latitude,
                              longitude: selectedVendor.longitude,
                            }
                          );
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.text,
                            padding: height * 0.01,
                            borderRadius: width * 0.025,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "white", fontWeight: "bold" }}>
                            Commandez
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Modal>
      )}

      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => handleZoom("in")}
        >
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => handleZoom("out")}
        >
          <Text style={styles.zoomText}>-</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  searchContainer: {
    height: height * 0.125,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 1,
    backgroundColor: "#ffffffe5",
    paddingTop: height * 0.055,
    paddingBottom: height * 0.015,
    padding: width * 0.025,
    shadowColor: "#666464",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    height: height * 0.05,
    borderRadius: width * 0.02,
    paddingHorizontal: width * 0.0375,
    marginRight: width * 0.025,
    borderColor: colors.prime,
    borderWidth: 2,
  },
  searchButton: {
    width: width * 0.1,
    height: width * 0.1,
    backgroundColor: colors.primary,
    borderRadius: width * 0.0125,
    justifyContent: "center",
    alignItems: "center",
  },
  vendorImage: {
    width: width * 0.25,
    height: height * 0.12,
    resizeMode: "cover",
    borderRadius: width * 0.02,
    marginHorizontal: width * 0.018,
  },
  markerIcon: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    width: width * 0.2,
    height: width * 0.2,
    justifyContent: "center",
    alignItems: "center",
  },
  markerImage: {
    width: width * 0.125,
    height: width * 0.125,
    resizeMode: "contain",
  },
  scrollContainer: {
    position: "absolute",
    bottom: height * 0.03,
    left: width * 0.01,
    right: width * 0.01,
    height: height * 0.15,
    zIndex: 10,
    width: ScreenWidth,
  },
  scrollContent: {
    paddingRight: width * 0.025,
  },
  vendorCard: {
    flexDirection: "row",
    backgroundColor: "#ffffffff",
    borderRadius: width * 0.06,
    paddingHorizontal: width * 0.025,
    paddingLeft: 0,
    marginRight: width * 0.025,
    width: ScreenWidth * 0.85,
    elevation: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: width * 0.025,
    padding: width * 0.05,
    width: "80%",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: height * 0.01,
    right: width * 0.025,
  },
  modalImage: {
    width: width * 0.2,
    height: width * 0.2,
    resizeMode: "cover",
    marginBottom: height * 0.01,
    borderRadius: width * 0.025,
  },
  modalTitle: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    marginBottom: height * 0.025,
    color: colors.primary,
  },
  filterButton: {
    position: "absolute",
    bottom: height * 0.02,
    right: width * 0.02,
    backgroundColor: colors.primary,
    borderRadius: width * 0.125,
    width: width * 0.125,
    height: width * 0.125,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  filterModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  filterModalContent: {
    backgroundColor: "white",
    borderRadius: width * 0.025,
    padding: width * 0.05,
    width: "80%",
    alignItems: "center",
  },
  filterModalTitle: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    marginBottom: height * 0.02,
    color: colors.primary,
  },
  filterLabel: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    marginBottom: height * 0.01,
    color: colors.primary,
  },
  slider: {
    width: "100%",
    marginBottom: height * 0.02,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: height * 0.01,
  },
  checkboxLabel: {
    fontSize: width * 0.04,
    marginLeft: width * 0.02,
    color: colors.primary,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: width * 0.02,
    padding: height * 0.01,
    marginTop: height * 0.02,
  },
  applyButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  clearButton: {
    backgroundColor: colors.primary,
    borderRadius: width * 0.02,
    padding: height * 0.01,
    marginTop: height * 0.01,
  },
  clearButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  zoomControls: {
    position: "absolute",
    bottom: height * 0.2, // Positionnez les boutons où vous voulez
    right: width * 0.02,
    zIndex: 10,
    flexDirection: "column", // Pour avoir les boutons en colonne
  },
  zoomButton: {
    backgroundColor: "#fff",
    width: width * 0.1,
    height: width * 0.1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: width * 0.05,
    marginVertical: height * 0.01,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  zoomText: {
    fontSize: width * 0.06,
    fontWeight: "bold",
  },
});

export default NearbyVendors1;
