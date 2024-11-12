import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { supabase } from "./supabase";
import { CheckBox } from "react-native-elements";
import colors from "../constants/colors";
import { FontAwesome6 } from "@expo/vector-icons";

const VendorContent = ({ route, navigation }) => {
  const [name, setName] = useState("");
  const [brands, setBrands] = useState([]);
  const [bottleTypes, setBottleTypes] = useState({});
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("User not found");

        // Récupérer les informations du vendeur connecté
        const { data: vendorData, error: vendorError } = await supabase
          .from("vendors")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (vendorError) throw vendorError;
        if (!vendorData) throw new Error("Vendor data not found");

        setName(vendorData.name || "");

        // Récupérer les marques depuis Supabase
        const { data: brandsData, error: brandsError } = await supabase
          .from("brands")
          .select("*");

        if (brandsError) throw brandsError;

        const selectedBrands = brandsData.map((brand) => ({
          ...brand,
          selected: vendorData.brands?.includes(brand.name) || false,
        }));
        setBrands(selectedBrands);

        // Récupérer les types de bouteilles et les prix depuis Supabase
        const { data: bottleTypesData, error: bottleTypesError } =
          await supabase.from("bottle_types").select("*");

        if (bottleTypesError) throw bottleTypesError;

        const bottleTypesMap = {};
        const pricesMap = {};

        bottleTypesData.forEach((item) => {
          const brandName = brandsData.find(
            (brand) => brand.id === item.brand_id
          )?.name;
          if (brandName) {
            if (!bottleTypesMap[brandName]) {
              bottleTypesMap[brandName] = {};
              pricesMap[brandName] = {};
            }
            bottleTypesMap[brandName][item.type] =
              vendorData.bottleTypes?.[brandName]?.includes(item.type) || false;
            pricesMap[brandName][item.type] =
              vendorData.prices?.[brandName]?.[item.type] || "";
          }
        });

        // Initialiser les valeurs de bottleTypes et prices avec des objets vides
        brandsData.forEach((brand) => {
          if (!bottleTypesMap[brand.name]) {
            bottleTypesMap[brand.name] = {};
            pricesMap[brand.name] = {};
          }
        });

        setBottleTypes(bottleTypesMap);
        setPrices(pricesMap);
      } catch (error) {
        console.error("Error:", error.message);
        Alert.alert(
          "Erreur",
          "Impossible de récupérer les données: " + error.message
        );
      }
    };

    fetchData();
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

  const handleSubmit = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("User not found");

      const updatedBrands = brands
        .filter((brand) => brand.selected)
        .map((brand) => brand.name);

      const updatedBottleTypes = Object.keys(bottleTypes).reduce(
        (acc, brandName) => {
          acc[brandName] = Object.keys(bottleTypes[brandName] || {}).filter(
            (type) => bottleTypes[brandName][type]
          );
          return acc;
        },
        {}
      );

      const updatedPrices = Object.keys(prices).reduce((acc, brandName) => {
        acc[brandName] = Object.keys(prices[brandName] || {}).reduce(
          (brandAcc, type) => {
            if (
              prices[brandName][type] !== undefined &&
              prices[brandName][type] !== null
            ) {
              brandAcc[type] = prices[brandName][type];
            }
            return brandAcc;
          },
          {}
        );
        return acc;
      }, {});

      // Mettre à jour les informations du vendeur
      const { error: vendorError } = await supabase
        .from("vendors")
        .update({
          brands: updatedBrands,
          bottleTypes: updatedBottleTypes,
          prices: updatedPrices,
        })
        .eq("user_id", user.id);

      if (vendorError) {
        console.error(
          "Erreur lors de la mise à jour des informations du vendeur:",
          vendorError
        );
        Alert.alert(
          "Erreur",
          "Impossible de mettre à jour les informations du vendeur"
        );
      } else {
        Alert.alert("Succès", "Informations mises à jour avec succès");
        //   navigation.goBack();
      }
    } catch (error) {
      console.error("Erreur générale:", error);
      Alert.alert("Erreur", "Une erreur inattendue s'est produite");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
          <Text style={{ ...styles.sectionTitle, color: colors.primary }}>
            {name}
          </Text>
        <TouchableOpacity
          style={{ marginLeft: 10 }}
          onPress={() => {
            supabase.auth.signOut();
            navigation.navigate("LoginScreen");
          }}
        >
          <FontAwesome6 name="right-from-bracket" size={24} color={colors.primary} />
        </TouchableOpacity>
        </View>
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
                {Object.keys(bottleTypes[brand.name] || {}).map((type) => (
                  <View key={type} style={styles.checkboxContainer}>
                    <CheckBox
                      title={type}
                      checked={bottleTypes[brand.name]?.[type] || false}
                      containerStyle={{ width: 300, paddingVertical: 30 }}
                      onPress={() =>
                        handleBottleTypeChange(
                          brand.name,
                          type,
                          !bottleTypes[brand.name]?.[type]
                        )
                      }
                    />
                    {bottleTypes[brand.name]?.[type] && (
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
                        value={prices[brand.name]?.[type] || ""}
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
          <Text style={styles.buttonText1}>Mettre à jour</Text>
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
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
});

export default VendorContent;
