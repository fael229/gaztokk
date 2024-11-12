import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import * as Location from "expo-location";
import { supabase } from "./supabase";
import { CheckBox } from "react-native-elements";
import colors from "../constants/colors";
import Header1 from "../components/header1";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { FontAwesome6 } from "@expo/vector-icons";

Mapbox.setAccessToken(
  "pk.eyJ1IjoiZmFmYTMzIiwiYSI6ImNtMGY0OTMwejB3a3Iya3F2ODZhajFnZncifQ.HDHHl3WzIPy2fI-aB1b2Sw"
);

const Addvendor = ({ navigation }) => {
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lieu, setLieu] = useState("");
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(null);
  const [brands, setBrands] = useState([]);
  const [bottleTypes, setBottleTypes] = useState({});
  const [prices, setPrices] = useState({});
  const [images, setImages] = useState([]);
  const [markerCoordinate, setMarkerCoordinate] = useState(null);

  const mapRef = useRef(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      setImages([...images, ...result.assets]);
    }
  };

  const uploadImages = async (user) => {
    const uploadedUrls = [];
    for (let image of images) {
      try {
        if (!image.base64) {
          console.error("No base64 data for image:", image.uri);
          continue;
        }

        const fileExt = image.uri.split(".").pop();
        const fileName = `${Math.random()
          .toString(36)
          .substring(2, 15)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("vendors")
          .upload(filePath, decode(image.base64), {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) {
          console.error("Error uploading image:", uploadError);
        } else {
          const {
            data: { publicUrl },
            error: urlError,
          } = supabase.storage.from("vendors").getPublicUrl(filePath);

          if (!urlError) {
            uploadedUrls.push(publicUrl);
          } else {
            console.error("Error getting public URL:", urlError);
          }
        }
      } catch (error) {
        console.error("General error processing image:", error);
      }
    }
    return uploadedUrls;
  };

  const handleMapPress = useCallback((event) => {
    const { coordinates } = event.geometry;
    setLocation({
      longitude: coordinates[0],
      latitude: coordinates[1],
    });
    setMarkerCoordinate({
      longitude: coordinates[0],
      latitude: coordinates[1],
    });
  }, []);

  const CustomMarker = useMemo(() => (
    <View style={styles.markerContainer}>
      <FontAwesome6 name="map-pin" size={30} color={colors.secondary} />
    </View>
  ), []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(location.coords);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0122,
        longitudeDelta: 0.0121,
      });
      setMarkerCoordinate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Récupérer les marques depuis Supabase
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("*");

      if (brandsError) {
        console.error("Error fetching brands:", brandsError);
      } else {
        setBrands(brandsData);
      }

      // Récupérer les types de bouteilles et les prix depuis Supabase
      const { data: bottleTypesData, error: bottleTypesError } = await supabase
        .from("bottle_types")
        .select("*");

      if (bottleTypesError) {
        console.error("Error fetching bottle types:", bottleTypesError);
      } else {
        const bottleTypesMap = {};
        const pricesMap = {};

        bottleTypesData.forEach((item) => {
          const brandName = brandsData.find(
            (brand) => brand.id === item.brand_id
          ).name;
          if (!bottleTypesMap[brandName]) {
            bottleTypesMap[brandName] = {};
            pricesMap[brandName] = {};
          }
          bottleTypesMap[brandName][item.type] = false;
          pricesMap[brandName][item.type] = item.price;
        });

        setBottleTypes(bottleTypesMap);
        setPrices(pricesMap);
      }
    })();
  }, []);

  const handleMarkerDragEnd = useCallback((e) => {
    const newCoordinate = e.geometry.coordinates;
    setLocation({
      longitude: newCoordinate[0],
      latitude: newCoordinate[1],
    });
    setMarkerCoordinate({
      longitude: newCoordinate[0],
      latitude: newCoordinate[1],
    });
  }, []);

  const handleBrandChange = (brandName, isChecked) => {
    setBrands((prevBrands) =>
      prevBrands.map((brand) =>
        brand.name === brandName ? { ...brand, selected: isChecked } : brand
      )
    );
  };

  const handleBottleTypeChange = (brandName, type, isChecked) => {
    setBottleTypes((prevTypes) => ({
      ...prevTypes,
      [brandName]: { ...prevTypes[brandName], [type]: isChecked },
    }));
  };

  const handlePriceChange = (brandName, type, price) => {
    setPrices((prevPrices) => ({
      ...prevPrices,
      [brandName]: { ...prevPrices[brandName], [type]: price },
    }));
  };

  const handleRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
    setLocation({
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    });
  };

  const handleSubmit = async () => {
    if (!name || !location) {
      Alert.alert("Veuillez remplir tous les champs");
      return;
    }

    try {
      // Sign up the vendor as a user in Supabase
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error(
          "Erreur lors de l'enregistrement de l'utilisateur :",
          signUpError
        );
        Alert.alert("Erreur", "Impossible de créer le compte utilisateur");
        return;
      }

      console.log("Utilisateur enregistré avec succès:", user);

      // Upload images
      const imageUrls = await uploadImages(user);
      console.log("Images téléchargées avec succès:", imageUrls);

      // Insert vendor data
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .insert({
          name,
          latitude: location.latitude,
          longitude: location.longitude,
          brands: brands
            .filter((brand) => brand.selected)
            .map((brand) => brand.name),
          bottleTypes: Object.keys(bottleTypes).reduce((acc, brandName) => {
            acc[brandName] = Object.keys(bottleTypes[brandName]).filter(
              (type) => bottleTypes[brandName][type]
            );
            return acc;
          }, {}),
          prices,
          imageurls: imageUrls,
          tel,
          lieu,
          email,
          user_id: user.id,
        })
        .select();

      if (vendorError) {
        console.error("Erreur lors de l'insertion du vendeur:", vendorError);
        Alert.alert(
          "Erreur",
          `Impossible d'enregistrer le vendeur: ${vendorError.message}`
        );
      } else {
        console.log("Données du vendeur insérées avec succès:", vendorData);
        Alert.alert("Succès", "Vendeur enregistré avec succès");
        await supabase.auth.signOut();
        navigation.goBack();
      }
    } catch (error) {
      console.error("Erreur générale:", error);
      Alert.alert("Erreur", "Une erreur inattendue s'est produite");
    }
  };

  return (
    <View style={styles.container}>
      <Header1
        title="Ajouter un vendeur"
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={{ paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={{ ...styles.input, marginTop: 10 }}
          value={name}
          onChangeText={setName}
          paddingVertical={20}
          paddingHorizontal={15}
          fontSize={20}
          color={colors.title}
          placeholder="Nom de l'entité"
        />
        <TextInput
          style={{ ...styles.input, marginTop: 10 }}
          value={tel}
          onChangeText={setTel}
          paddingVertical={20}
          paddingHorizontal={15}
          fontSize={20}
          color={colors.title}
          placeholder="Téléphone"
        />
        <TextInput
          style={{ ...styles.input, marginTop: 10 }}
          value={lieu}
          onChangeText={setLieu}
          paddingVertical={20}
          paddingHorizontal={15}
          fontSize={20}
          color={colors.title}
          placeholder="Indicaion géographique"
        />
        <TextInput
          style={{ ...styles.input, marginTop: 10 }}
          value={email}
          onChangeText={setEmail}
          paddingVertical={20}
          paddingHorizontal={15}
          fontSize={20}
          color={colors.title}
          placeholder="Email"
        />
        <TextInput
          style={{ ...styles.input, marginTop: 10 }}
          value={password}
          onChangeText={setPassword}
          paddingVertical={20}
          paddingHorizontal={15}
          fontSize={20}
          color={colors.title}
          placeholder="Mot de passe"
        />
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Image Vendeur</Text>
        </TouchableOpacity>
        <View style={styles.imageContainer}>
          {images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image.uri }}
              style={styles.image}
            />
          ))}
        </View>
        {region && (
          <View style={styles.mapContainer}>
            <Mapbox.MapView
              ref={mapRef}
              style={styles.map}
              onPress={handleMapPress}
            >
              <Mapbox.Camera
                defaultSettings={{
                  zoomLevel: 16,
                  centerCoordinate: [region.longitude, region.latitude],
                }}
              />
              {markerCoordinate && (
                <Mapbox.PointAnnotation
                  id="vendorLocation"
                  coordinate={[markerCoordinate.longitude, markerCoordinate.latitude]}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                >
                  {CustomMarker}
                </Mapbox.PointAnnotation>
              )}
            </Mapbox.MapView>
            <Text style={styles.mapInstructions}>
              Appuyez sur la carte pour placer le marqueur ou faites-le glisser pour ajuster la position
            </Text>
          </View>
        )}
        <Text style={{ ...styles.sectionTitle, color: colors.title }}>
          Marques de gaz
        </Text>
        {brands.map((brand) => (
          <View key={brand.id} style={styles.checkboxContainer}>
            <CheckBox
              title={brand.name}
              containerStyle={{
                width: 300,
                paddingVertical: 30,
                color: colors.primary,
              }}
              checked={brand.selected}
              onPress={() => handleBrandChange(brand.name, !brand.selected)}
            />
          </View>
        ))}
        {brands.map(
          (brand) =>
            brand.selected && (
              <View key={brand.id}>
                <Text style={styles.sectionTitle}>{brand.name}</Text>
                {Object.keys(bottleTypes[brand.name]).map((type) => (
                  <View key={type} style={styles.checkboxContainer}>
                    <CheckBox
                      title={type}
                      checked={bottleTypes[brand.name][type]}
                      containerStyle={{ width: 300, paddingVertical: 30 }}
                      onPress={() =>
                        handleBottleTypeChange(
                          brand.name,
                          type,
                          !bottleTypes[brand.name][type]
                        )
                      }
                    />
                    {bottleTypes[brand.name][type] && (
                      <TextInput
                        style={{
                          ...styles.input,
                          width: 300,
                          paddingVertical: 20,
                          paddingHorizontal: 15,
                          fontSize: 20,
                          color: colors.title,
                        }}
                        keyboardType="numeric"
                        placeholder={`Prix ${type}`}
                        value={prices[brand.name][type]}
                        onChangeText={(price) =>
                          handlePriceChange(brand.name, type, price)
                        }
                      />
                    )}
                  </View>
                ))}
              </View>
            )
        )}
        <TouchableOpacity style={styles.button1} onPress={handleSubmit}>
          <Text style={styles.buttonText1}>Enregistrer</Text>
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    marginBottom: 20,
  },
  map: {
    width: "100%",
    height: 300,
    borderRadius: 10,
  },
  mapInstructions: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    color: colors.primary,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  checkboxContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  button: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 5,
    marginTop: 10,
    width: 300,
    alignSelf: "center",
  },
  button1: {
    padding: 20,
    borderRadius: 5,
    borderWidth: 1,
    marginTop: 10,
    borderColor: colors.primary,
    width: 300,
    alignSelf: "center",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 14,
  },
  buttonText1: {
    color: colors.primary,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  container: {
    paddingTop: 60,
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  backButton: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.primary,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  imageContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  image: {
    width: 100,
    height: 100,
    margin: 5,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    paddingVertical: 15,
    marginBottom: 10,
    borderRadius: 5,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalItem: {
    padding: 10,
    marginVertical: 5,
  },
  markerView: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 10,
    borderRadius: 5,
  },
  markerText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default Addvendor;
