import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  SafeAreaView,
} from "react-native";
import {
  Feather,
  FontAwesome6,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import colors from "../constants/colors";
import MultiSelect from "react-native-multiple-select";
import { Divider } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location"; // Import expo-location
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";
import { Appbar } from "react-native-paper";

const VENDORS_STORAGE_KEY = "vendors_data";
const { width, height } = Dimensions.get("window");

export default function Compare() {
  const navigation = useNavigation();
  const [vendors, setVendors] = useState([]);
  const [selectedMarques, setSelectedMarques] = useState(["ORIX"]);
  const [selectedTypes, setSelectedTypes] = useState(["large"]);
  const [dist, setDist] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  
  const [userLoc, setUserLoc] = useState(null);
  const [vendorLoc, setVendorLoc] = useState(null);
  const [visibility, setVisibility] = useState(false);

  // New state variables for user location
  const [userLocation, setUserLocation] = useState(null);
  const [locationErrorMsg, setLocationErrorMsg] = useState(null);

  const OPTIONS = [
    { label: "ORIX", value: "ORIX" },
    { label: "BENIN PETRO", value: "BENIN PETRO" },
  ];

  const TYPE = [
    { label: "Grande bouteille", value: "large" },
    { label: "Petite bouteille", value: "small" },
  ];

  // Request user location
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
        locationSubscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        });

        const location = await Location.getCurrentPositionAsync();
        setUserLocation(location.coords);
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
  }, []);

  // Function to calculate distance using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // in meters
    return distance;
  };

  // Function to fetch and store vendors
  const loadVendorsFromStorage = async () => {
    try {
      const storedVendors = await AsyncStorage.getItem(VENDORS_STORAGE_KEY);
      if (storedVendors !== null) {
        let parsedVendors = JSON.parse(storedVendors);

        // Sort vendors by distance if user location is available
        if (userLocation) {
          parsedVendors = sortVendorsByDistance(parsedVendors);
        }

        setVendors(parsedVendors);
        console.log("Initial load: Vendors loaded from storage");
        return true; // Indique que des données ont été chargées depuis le cache
      }
      return false; // Indique qu'aucune donnée n'était en cache
    } catch (error) {
      console.error("Error loading vendors from storage:", error);
      return false;
    }
  };

  // Modified function to load and sort vendors from AsyncStorage
  const fetchAndStoreVendors = async () => {
    try {
      const { data, error } = await supabase.from("vendors").select("*");
      if (error) {
        console.error("Error fetching vendors:", error);
        return;
      }

      const vendorsWithValidCoordinates = data
        .map((vendor) => ({
          ...vendor,
          longitude: parseFloat(vendor.longitude),
          latitude: parseFloat(vendor.latitude),
        }))
        .filter(
          (vendor) => !isNaN(vendor.latitude) && !isNaN(vendor.longitude)
        );

      const sortedVendors = userLocation
        ? sortVendorsByDistance(vendorsWithValidCoordinates)
        : vendorsWithValidCoordinates;

      // Comparer avec les données actuelles avant de mettre à jour
      const currentVendors = vendors;
      const hasChanges =
        JSON.stringify(sortedVendors) !== JSON.stringify(currentVendors);

      if (hasChanges) {
        setVendors(sortedVendors);
        await AsyncStorage.setItem(
          VENDORS_STORAGE_KEY,
          JSON.stringify(sortedVendors)
        );
        console.log("Background sync: Vendors updated from database");
      } else {
        console.log("Background sync: No changes detected");
      }
    } catch (error) {
      console.error("Error in background sync:", error);
    }
  };

  const sortVendorsByDistance = useCallback(
    (vendorsToSort) => {
      if (!userLocation) return vendorsToSort;

      return [...vendorsToSort].sort((a, b) => {
        const distanceA = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          a.latitude,
          a.longitude
        );
        const distanceB = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          b.latitude,
          b.longitude
        );
        return distanceA - distanceB;
      });
    },
    [userLocation]
  );

  // Setup real-time subscriptions
  const setupRealtimeSubscriptions = useCallback(() => {
    console.log("Initializing Realtime subscriptions...");

    const channel = supabase
      .channel("vendors-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        async (payload) => {
          console.log("Change received!", payload);
          const { eventType, new: newRecord, old: oldRecord } = payload;

          // Fonction pour mettre à jour le stockage local
          const updateLocalStorage = async (updatedVendors) => {
            try {
              await AsyncStorage.setItem(
                VENDORS_STORAGE_KEY,
                JSON.stringify(updatedVendors)
              );
            } catch (error) {
              console.error("Error updating local storage:", error);
            }
          };

          // Fonction pour trier les vendeurs par distance
          const sortVendorsByDistance = (vendorsToSort) => {
            if (!userLocation) return vendorsToSort;

            return [...vendorsToSort].sort((a, b) => {
              const distanceA = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                parseFloat(a.latitude),
                parseFloat(a.longitude)
              );
              const distanceB = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                parseFloat(b.latitude),
                parseFloat(b.longitude)
              );
              return distanceA - distanceB;
            });
          };

          // Gérer les différents types d'événements
          switch (eventType) {
            case "INSERT":
              setVendors((currentVendors) => {
                const vendorExists = currentVendors.some(
                  (v) => v.id === newRecord.id
                );
                if (vendorExists) return currentVendors;

                const updatedVendors = sortVendorsByDistance([
                  ...currentVendors,
                  {
                    ...newRecord,
                    latitude: parseFloat(newRecord.latitude),
                    longitude: parseFloat(newRecord.longitude),
                  },
                ]);
                updateLocalStorage(updatedVendors);
                return updatedVendors;
              });
              break;

            case "UPDATE":
              setVendors((currentVendors) => {
                const updatedVendors = sortVendorsByDistance(
                  currentVendors.map((vendor) =>
                    vendor.id === newRecord.id
                      ? {
                          ...newRecord,
                          latitude: parseFloat(newRecord.latitude),
                          longitude: parseFloat(newRecord.longitude),
                        }
                      : vendor
                  )
                );
                updateLocalStorage(updatedVendors);
                return updatedVendors;
              });
              break;

            case "DELETE":
              setVendors((currentVendors) => {
                const updatedVendors = currentVendors.filter(
                  (vendor) => vendor.id !== oldRecord.id
                );
                updateLocalStorage(updatedVendors);
                return updatedVendors;
              });
              break;

            default:
              console.log("Unhandled event type:", eventType);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to Realtime channel");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Error subscribing to Realtime channel");
          // Tentative de reconnexion après un délai
          setTimeout(() => {
            setupRealtimeSubscriptions();
          }, 5000);
        }
      });

    return () => {
      console.log("Unsubscribing from Realtime channel...");
      supabase.removeChannel(channel);
    };
  }, [userLocation]); // Dépendance ajoutée pour userLocation

  // Modify the useEffect hook to re-sort vendors when user location changes
  useEffect(() => {
    let unsubscribe;

    const initializeData = async () => {
      // 1. Charger d'abord depuis le cache
      const cachedDataLoaded = await loadVendorsFromStorage();

      // 2. Mettre en place les souscriptions realtime
      unsubscribe = setupRealtimeSubscriptions();

      // 3. Si pas de données en cache OU après le chargement du cache,
      // faire une requête en arrière-plan pour les mises à jour
      if (!cachedDataLoaded) {
        // Pas de données en cache, chargement immédiat nécessaire
        await fetchAndStoreVendors();
      } else {
        // Données en cache chargées, vérifier les mises à jour en arrière-plan
        setTimeout(() => {
          fetchAndStoreVendors();
        }, 1000); // Délai court pour prioriser le rendu initial
      }
    };

    initializeData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setupRealtimeSubscriptions, userLocation]);

  const handleVendorPress = (vendorId) => {
    const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
    if (selectedVendor) {
      console.log(selectedVendor);
      setSelectedVendor(selectedVendor);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedVendor(null);
  };

  const handleOrder = (brand, type, price, distance, userLoc, vendorLoc) => {
    navigation.navigate("Checkout", {
      vendor: selectedVendor,
      product: { brand, type, price, distance, userLoc, vendorLoc },
    });
    setModalVisible(false);
    console.log(
      "Order placed: ",
      brand,
      type,
      price,
      distance,
      userLoc,
      vendorLoc
    );
  };

  // Filter vendors based on selected brands and types
  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.prices &&
      selectedMarques.some((marque) => vendor.prices[marque]) &&
      selectedTypes.some((type) =>
        selectedMarques.some(
          (marque) => vendor.prices[marque] && vendor.prices[marque][type]
        )
      )
  );

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      {/* <View style={styles.backgroundContainer}>
        <Image
          source={require("../../assets/bg1.jpg")}
          style={styles.backgroundImage}
        />
      </View> */}
      <Appbar.Header style={{ backgroundColor: "white", paddingBottom: 0 }}>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          color={colors.secondary}
        />
        <Appbar.Content
          title="Comparez les vendeurs"
          titleStyle={{
            fontSize: width * 0.056,
            color: colors.secondary,
            fontWeight: "bold",
            paddingBottom: height * 0.01,
          }}
        />
      </Appbar.Header>
      <TouchableOpacity
        onPress={() => {
          setVisibility(!visibility);
        }}
        style={{
          position: "absolute",
          bottom: width * 0.25,
          right: width * 0.04,
          zIndex: 1,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
          }}
        >
          <Image
            source={require("../../assets/bg1.jpg")}
            style={{
              flex: 1,
              resizeMode: "stretch",
              opacity: 0.3,
              borderRadius: 50,
              width: width * 0.17,
              height: width * 0.17,
            }}
          />
        </View>
        <View
          style={{
            ...styles.markerIcon,
            backgroundColor: "#000000",
            borderRadius: 50,
            width: width * 0.17,
            height: width * 0.17,
            justifyContent: "center",
            alignItems: "center",
            elevation: 15,
          }}
        >
          <Feather
            name={visibility ? "x" : "filter"}
            size={width * 0.07}
            color="white"
            style={{ elevation: 15 }}
          />
        </View>
      </TouchableOpacity>
      <View
        style={{
          margin: width * 0.04,
          flexDirection: "column",
          justifyContent: "space-between",
          gap: width * 0.025,
          borderColor: "#CCC",
          borderWidth: 2,
          padding: width * 0.04,
          borderRadius: 30,
          display: visibility ? "flex" : "none",
        }}
      >
        <View style={{ flexGrow: 1 }}>
          <MultiSelect
            items={OPTIONS}
            uniqueKey="value"
            onSelectedItemsChange={setSelectedMarques}
            selectedItems={selectedMarques}
            selectText="Marques"
            searchInputPlaceholderText="Marques..."
            tagRemoveIconColor="#CCC"
            tagBorderColor="#CCC"
            tagTextColor="#CCC"
            selectedItemTextColor="#CCC"
            selectedItemIconColor="#CCC"
            itemTextColor="#000"
            displayKey="label"
            styleTextTag={{ color: "#333333", fontSize: 11 }}
            itemFontSize={width * 0.035}
            searchInputStyle={{ color: "#333333" }}
            submitButtonColor="#CCC"
            submitButtonText="Choisir"
          />
        </View>
        <View style={{ flexGrow: 1 }}>
          <MultiSelect
            items={TYPE}
            uniqueKey="value"
            onSelectedItemsChange={setSelectedTypes}
            selectedItems={selectedTypes}
            selectText="Types"
            searchInputPlaceholderText="Types..."
            tagRemoveIconColor="#CCC"
            tagBorderColor="#CCC"
            tagTextColor="#CCC"
            selectedItemTextColor="#CCC"
            selectedItemIconColor="#CCC"
            itemTextColor="#000"
            displayKey="label"
            itemFontSize={width * 0.035}
            styleTextTag={{ color: "#333333", fontSize: 11 }}
            tagContainerStyle={{ width: width * 0.4 }}
            searchInputStyle={{ color: "#333333" }}
            submitButtonColor="#CCC"
            submitButtonText="Choisir"
          />
        </View>
      </View>
      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: vendor }) => {
          let distanceText = "";

          if (userLocation && vendor.latitude && vendor.longitude) {
            const distanceInMeters = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              vendor.latitude,
              vendor.longitude
            );

            if (distanceInMeters < 1000) {
              distanceText = `${Math.round(distanceInMeters)} m`;
            } else {
              distanceText = `${(distanceInMeters / 1000).toFixed(2)} km`;
            }
          } else {
            distanceText = "Distance unavailable";
          }

          return (
            <View>
              <TouchableOpacity
                onPress={() => {
                  handleVendorPress(vendor.id);
                  const distanceInMeters = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    vendor.latitude,
                    vendor.longitude
                  );
                  setDist(distanceInMeters / 1000);
                  setVendorLoc({
                    latitude: vendor.latitude,
                    longitude: vendor.longitude,
                  });
                  setUserLoc({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  });
                }}
                activeOpacity={0.9}
              >
                <View
                  style={{
                    ...styles.vendorCard,
                    alignItems: "center",
                    margin: width * 0.03,
                  }}
                >
                  <View
                    style={{
                      padding: width * 0.05,
                      flexDirection: "column",
                      padding: width * 0.05,
                      flexGrow: 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        flexGrow: 1,
                        justifyContent: "space-between",
                        padding: width * 0.025,
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={{
                            color: colors.title,
                            fontSize: width * 0.05,
                            fontWeight: "bold",
                          }}
                        >
                          {vendor?.name}
                        </Text>
                      </View>
                      <Image
                        source={{ uri: vendor?.imageurls[0] }}
                        style={styles.vendorImage}
                      />
                    </View>
                    {/* Display Distance Below Vendor Name */}
                    <View
                      style={{
                        flexDirection: "row",
                        paddingTop: height * 0.01,
                        paddingBottom: height * 0.01,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="map-marker-distance"
                        size={width * 0.06}
                        color={colors.secondary}
                        style={{
                          marginRight: width * 0.02,
                          paddingTop: height * 0.009,
                        }}
                      />
                      <Text
                        style={{
                          color: colors.title,
                          fontSize: width * 0.035,
                          paddingTop: height * 0.01,
                        }}
                      >
                        Distance: {distanceText}
                      </Text>
                    </View>

                    {selectedMarques.map((marque) =>
                      selectedTypes.map(
                        (type) =>
                          vendor.prices[marque] &&
                          vendor.prices[marque][type] && (
                            <View
                              key={`${marque}-${type}`}
                              style={{
                                flexDirection: "row",
                                paddingTop: height * 0.01,
                                paddingBottom: height * 0.01,
                              }}
                            >
                              <FontAwesome6
                                name="tag"
                                size={width * 0.04}
                                color={colors.secondary}
                                style={{
                                  marginRight: width * 0.02,
                                  // paddingTop: height * 0.01,
                                }}
                              />
                              <Text
                                style={{
                                  color: colors.title,
                                  fontSize: width * 0.035,
                                }}
                              >
                                {type === "large"
                                  ? `${marque} Grand: ${vendor.prices[marque][type]} FCFA `
                                  : `${marque} Petite: ${vendor.prices[marque][type]} FCFA `}
                              </Text>
                            </View>
                          )
                      )
                    )}

                    {/* <Divider
                      style={{
                        marginTop: height * 0.01,
                        marginBottom: height * 0.01,
                      }}
                    /> */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <View>
                        <View style={{ flexDirection: "row" }}>
                          <FontAwesome6
                            name="map-pin"
                            size={width * 0.04}
                            color={colors.secondary}
                            style={{
                              marginRight: width * 0.02,
                              paddingTop: height * 0.01,
                            }}
                          />
                          <Text
                            style={{
                              color: colors.title,
                              fontSize: width * 0.035,
                              paddingTop: height * 0.01,
                            }}
                          >
                            {vendor?.lieu.slice(0, 15) +
                              (vendor?.lieu.length > 15 ? "..." : "")}
                          </Text>
                        </View>
                      </View>
                      {/* <TouchableOpacity
                    onPress={() => {
                      handleVendorPress(vendor.id);
                      const distanceInMeters = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        vendor.latitude,
                        vendor.longitude
                      );
                      setDist(distanceInMeters / 1000);
                      setVendorLoc({
                        latitude: vendor.latitude,
                        longitude: vendor.longitude,
                      });
                      setUserLoc({
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                      });
                    }}
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
                      <Feather
                        name="send"
                        size={width * 0.05}
                        color="white"
                      />
                    </View>
                  </TouchableOpacity> */}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <Divider
                style={{
                  marginTop: height * 0.01,
                  marginBottom: height * 0.01,
                }}
              />
            </View>
          );
        }}
      />
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
              <View style={{ maxHeight: height * 0.3 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
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
                            style={{ marginLeft: width * 0.05 }}
                            onPress={() =>
                              handleOrder(
                                brand,
                                type,
                                selectedVendor.prices[brand][type],
                                dist,
                                userLoc,
                                vendorLoc
                              )
                            }
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
                              <Text
                                style={{
                                  color: "white",
                                  fontWeight: "bold",
                                  fontSize: width * 0.03,
                                }}
                              >
                                Commandez
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: width * 0.05,
  },
  backgroundContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: "repeat",
    opacity: 0.1,
  },
  vendorImage: {
    width: width * 0.175,
    height: width * 0.175,
    resizeMode: "cover",
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.secondary,
  },
  markerIcon: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedDropLeft: {
    width: width * 0.8,
    position: "absolute",
    left: width * 0.45,
    top: width * 0.15,
  },
  selectedDropRight: {
    position: "absolute",
    width: width * 0.8,
    right: width * 0.4,
    top: width * 0.15,
  },
  vendorCard: {
    flexDirection: "row",
    // borderRadius: width * 0.1,
    paddingHorizontal: width * 0.025,
    paddingLeft: 0,
    marginRight: width * 0.025,
    width: width * 0.85,
    // shadowColor: "black",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.2,
    // shadowRadius: 5,
    // elevation: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: width * 0.05,
    paddingVertical: width * 0.05,
    paddingHorizontal: width * 0.025,
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
  dropdown: {
    width: "100%",
    height: height * 0.05,
  },
  dropdownText: {
    fontSize: width * 0.015,
  },
});
