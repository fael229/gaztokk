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
import Mapbox, { Images, LocationPuck } from "@rnmapbox/maps";
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
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize Mapbox
Mapbox.setAccessToken(
  "pk.eyJ1IjoiZmFmYTMzIiwiYSI6ImNtMGY0OTMwejB3a3Iya3F2ODZhajFnZncifQ.HDHHl3WzIPy2fI-aB1b2Sw"
);

const VENDORS_STORAGE_KEY = 'VENDORS_DATA';

const NearbyVendors1 = () => {
  const navigation = useNavigation();
  const [userLocation, setUserLocation] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [originalVendors, setOriginalVendors] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(21);
  const [routeCoordinates, setRouteCoordinates] = useState(null);

  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const scrollViewRef = useRef(null);

  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    let locationSubscription;
    let supabaseChannel;

    const setupLocationAndData = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "L'accès à la localisation est nécessaire pour le bon fonctionnement de l'application."
          );
          return;
        }

        let { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== "granted") {
          Alert.alert(
            "Permission refusée",
            "La permission de localisation en arrière-plan n'a pas été accordée. Cela peut affecter certaines fonctionnalités de l'application.",
          );
        }

        await Location.enableNetworkProviderAsync();

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            console.log("User location:", location.coords);
            setUserLocation([
              location.coords.longitude,
              location.coords.latitude,
            ]);
            setZoomLevel(16);
          }
        );

        await fetchVendors();

        // Configurer le canal en temps réel pour la table 'vendors'
        supabaseChannel = supabase
          .channel('public:vendors') // Nom du canal, peut être n'importe quel identifiant unique
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'vendors' },
            payload => {
              console.log('Changement reçu de Supabase:', payload);
              handleSupabaseChange(payload);
            }
          )
          .subscribe();

      } catch (error) {
        console.error("Error setting up location and data:", error);
      }
    };

    setupLocationAndData();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, []);

  const fetchVendors = async () => {
    try {
      // Tenter de charger les vendeurs mis en cache depuis AsyncStorage
      const cachedVendors = await AsyncStorage.getItem(VENDORS_STORAGE_KEY);
      if (cachedVendors !== null) {
        const parsedVendors = JSON.parse(cachedVendors);
        setVendors(parsedVendors);
        setOriginalVendors(parsedVendors);
        console.log('Vendeurs chargés depuis AsyncStorage');
      } else {
        console.log('Aucun vendeur mis en cache trouvé');
      }

      // Récupérer les données fraîches depuis Supabase
      let { data, error } = await supabase.from("vendors").select("*");
      if (error) {
        console.error("Erreur lors de la récupération des vendeurs depuis Supabase:", error);
      } else {
        const vendorsWithValidCoordinates = data
          .filter(vendor => vendor.longitude && vendor.latitude)
          .map((vendor) => ({
            ...vendor,
            longitude: parseFloat(vendor.longitude),
            latitude: parseFloat(vendor.latitude),
          }));
        setVendors(vendorsWithValidCoordinates);
        setOriginalVendors(vendorsWithValidCoordinates);

        // Sauvegarder les données fraîches dans AsyncStorage
        await AsyncStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(vendorsWithValidCoordinates));
        console.log('Vendeurs récupérés et mis en cache depuis Supabase');
      }
    } catch (err) {
      console.error("Erreur dans fetchVendors:", err);
    }
  };

  const handleSupabaseChange = async (payload) => {
    try {
      let updatedVendors = [...vendors];

      if (payload.eventType === 'INSERT') {
        const newVendor = {
          ...payload.new,
          longitude: parseFloat(payload.new.longitude),
          latitude: parseFloat(payload.new.latitude),
        };
        updatedVendors.push(newVendor);
      } else if (payload.eventType === 'UPDATE') {
        updatedVendors = updatedVendors.map(vendor =>
          vendor.id === payload.new.id
            ? { ...payload.new, longitude: parseFloat(payload.new.longitude), latitude: parseFloat(payload.new.latitude) }
            : vendor
        );
      } else if (payload.eventType === 'DELETE') {
        updatedVendors = updatedVendors.filter(vendor => vendor.id !== payload.old.id);
      }

      setVendors(updatedVendors);
      setOriginalVendors(updatedVendors);

      // Mettre à jour AsyncStorage avec la nouvelle liste de vendeurs
      await AsyncStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify(updatedVendors));
      console.log('Données des vendeurs mises à jour et mises en cache après changement Supabase');
    } catch (error) {
      console.error('Erreur lors de la gestion du changement Supabase:', error);
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
      cameraRef.current?.setCamera({
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

  const handleOrder = (brand, type, price) => {
    navigation.navigate("Checkout", {
      vendor: selectedVendor,
      product: { brand, type, price },
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
      Alert.alert("Erreur", "Impossible de récupérer les directions. Veuillez réessayer.");
    }
  };

  const lineLayerStyle = {
    lineColor: "#9ca4f1",
    lineWidth: 9,
  };

  return (
    <View style={styles.container}>
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
          <Feather name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.scrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ref={scrollViewRef}
        >
          {vendors.map((vendor) => (
            <TouchableOpacity
              key={vendor.id}
              onPress={() => handleVendorPress(vendor.id)}
            >
              <View style={{ ...styles.vendorCard, alignItems: "center" }}>
                <Image
                  source={{ uri: vendor.imageurls[0] }}
                  style={styles.vendorImage}
                />
                <View
                  style={{
                    padding: 10,
                    flexDirection: "column",
                    paddingVertical: 20,
                    flexGrow: 1,
                  }}
                >
                  <View style={{ flexDirection: "row", flexGrow: 1 }}>
                    <Fontisto
                      name="shopping-store"
                      size={16}
                      color={colors.secondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={{
                        color: colors.title,
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      {vendor.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row" }}>
                    <FontAwesome6
                      name="map-pin"
                      size={16}
                      color={colors.secondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: colors.title, fontSize: 14 }} >
                      {vendor.lieu.slice(0, 15) + (vendor.lieu.length > 15 ? "..." : "")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleVendorPress1(vendor.id)}>
                  <View
                    style={{
                      ...styles.markerIcon,
                      backgroundColor: colors.primary,
                      borderRadius: 50,
                      width: 40,
                      height: 40,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Feather name="send" size={20} color="white" />
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {userLocation && (
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          logoEnabled={false}
          surfaceView={true}
        >
          <Mapbox.Camera
            ref={cameraRef}
            zoomLevel={zoomLevel}
            centerCoordinate={[userLocation[0], userLocation[1]]}
            followUserLocation={true}
            followUserMode={"compass"}
            onZoomChanged={(zoom) => setZoomLevel(zoom)}
            maxZoomLevel={18}
            minZoomLevel={16}
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
              <TouchableOpacity onPress={() => handleVendorPress(vendor.id)}>
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
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingTop: 20,
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
                  fontSize: 18,
                  fontWeight: "bold",
                  marginTop: 8,
                }}
              >
                Marques disponibles:
              </Text>
              {selectedVendor.brands.map((brand) => (
                <View key={brand} style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 18,
                      marginVertical: 8,
                      textTransform: "capitalize",
                      textDecorationLine: "underline",
                    }}
                  >
                    {brand}
                  </Text>
                  {selectedVendor.bottleTypes[brand].map((type) => (
                    <View
                      key={type}
                      style={{ flexDirection: "row", paddingBottom: 8 }}
                    >
                      <Text
                        style={{
                          color: colors.title,
                          fontSize: 16,
                          fontWeight: "bold",
                          marginHorizontal: 8,
                          padding: 6,
                        }}
                      >
                        {type}:
                      </Text>
                      {selectedVendor.prices[brand][type] && (
                        <Text
                          style={{
                            color: colors.title,
                            fontSize: 16,
                            padding: 6,
                          }}
                        >
                          {selectedVendor.prices[brand][type]} XOF
                        </Text>
                      )}
                      <TouchableOpacity
                        style={{ marginLeft: 20 }}
                        onPress={() =>
                          handleOrder(
                            brand,
                            type,
                            selectedVendor.prices[brand][type]
                          )
                        }
                      >
                        <View
                          style={{
                            backgroundColor: colors.text,
                            padding: 6,
                            borderRadius: 10,
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
    height: 120,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 1,
    backgroundColor: "#ffffffe5",
    paddingTop: 55,
    paddingBottom: 15,
    padding: 10,
    shadowColor: "#666464",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginRight: 10,
    borderColor: colors.prime,
    borderWidth: 2,
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  vendorImage: {
    width: 100,
    height: 110,
    resizeMode: "cover",
    borderBottomLeftRadius: 20,
    borderTopLeftRadius: 20,
  },
  markerIcon: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  markerImage: {
    width: 50,
    height: 50,
    resizeMode: "contain",
  },
  scrollContainer: {
    position: "absolute",
    bottom: 30,
    left: 10,
    right: 10,
    height: 150,
    zIndex: 10,
    width: ScreenWidth,
  },
  scrollContent: {
    paddingRight: 10,
  },
  vendorCard: {
    flexDirection: "row",
    backgroundColor: "#ffffffda",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingLeft: 0,
    marginRight: 10,
    width: ScreenWidth * 0.85,
    shadowColor: "black",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
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
    borderRadius: 20,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  modalImage: {
    width: 80,
    height: 80,
    resizeMode: "cover",
    marginBottom: 10,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.primary,
  },
  filterButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 50,
    width: 50,
    height: 50,
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
    borderRadius: 20,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: colors.primary,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.primary,
  },
  slider: {
    width: "100%",
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  checkboxLabel: {
    fontSize: 16,
    marginLeft: 8,
    color: colors.primary,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 10,
    marginTop: 20,
  },
  applyButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  clearButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  clearButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default NearbyVendors1;
