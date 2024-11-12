import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import colors from "../constants/colors";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";

const { width, height } = Dimensions.get("window");

const Categories = () => {
  const navigation = useNavigation();

  // Regroupement des animations
  const animations = {
    logo: {
      scale: useRef(new Animated.Value(0)).current,
      opacity: useRef(new Animated.Value(0)).current,
    },
    compare: {
      scale: useRef(new Animated.Value(0)).current,
      opacity: useRef(new Animated.Value(0)).current,
    },
    vendors: {
      scale: useRef(new Animated.Value(0)).current,
      opacity: useRef(new Animated.Value(0)).current,
    },
  };

  const animateElement = (element, delay) => {
    Animated.parallel([
      Animated.timing(element.scale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(element.opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    // Séquence d'animations
    const animationSequence = [
      { element: animations.logo, delay: 3000 },
      { element: animations.compare, delay: 4000 },
      { element: animations.vendors, delay: 5000 },
    ];

    animationSequence.forEach(({ element, delay }) => {
      setTimeout(() => animateElement(element), delay);
    });

    // Stockage AsyncStorage
    const stockage = async () => {
      try {
        await AsyncStorage.setItem("isLog", "true");
      } catch (error) {
        console.log(error);
      }
    };
    stockage();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <View style={styles.backgroundContainer}>
        <Image
          source={require("../../assets/bg1.jpg")}
          style={styles.backgroundImage}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Animated.Image
            source={require("../../assets/logo-gaztok.png")}
            style={[
              styles.logo,
              {
                opacity: animations.logo.opacity,
                transform: [{ scale: animations.logo.scale }],
              },
            ]}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.buttonWrapper}
            onPress={() => navigation.navigate("Compare")}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                styles.compareButton,
                {
                  opacity: animations.compare.opacity,
                  transform: [{ scale: animations.compare.scale }],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="compare-vertical"
                  size={width * 0.1}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.buttonText}>Comparer</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonWrapper}
            onPress={() => navigation.navigate("NearbyVendors1")}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                styles.vendorsButton,
                {
                  opacity: animations.vendors.opacity,
                  transform: [{ scale: animations.vendors.scale }],
                },
              ]}
            >
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="map-location-dot"
                  size={width * 0.09}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.buttonText}>Vendeurs</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    opacity: 0.2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  logoContainer: {
    marginTop: height * 0.08,
    width: width * 0.5,
    height: height * 0.15,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  buttonsContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: width * 0.08,
    paddingHorizontal: width * 0.05,
  },
  buttonWrapper: {
    width: width * 0.35,
    aspectRatio: 1,
  },
  compareButton: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: width * 0.1,
    justifyContent: "center",
    alignItems: "center",
    elevation: 25,
  },
  vendorsButton: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.secondary,
    borderRadius: width * 0.1,
    justifyContent: "center",
    alignItems: "center",
    elevation: 13,
  },
  iconContainer: {
    position: "absolute",
    backgroundColor: "white",
    padding: width * 0.05,
    borderRadius: width * 0.13,
    top: -width * 0.1,
    elevation: 5,
  },
  buttonText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: "#e7e4e4",
  },
});

export default Categories;
