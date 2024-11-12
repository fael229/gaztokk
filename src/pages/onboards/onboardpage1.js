import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import onboardImage1 from "../../../assets/onboard2.png";
import colors from "../../constants/colors";
import typography from "../../constants/typo";
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOfflineMap } from "../offlineMapHandler";

const { width, height } = Dimensions.get("window");

export default function Onboard1() {
  const navigate = useNavigation();
  const { checkAndInitializeOfflineMap, downloadOfflineMap } = useOfflineMap();
  const [isMapDownloaded, setIsMapDownloaded] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const isFirstLaunch = await AsyncStorage.getItem("isFirstLaunch");
        if (isFirstLaunch === null) {
          if (Platform.OS === "android") {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
              {
                title: "Permission de stockage",
                message:
                  "L'application a besoin d'accéder au stockage pour sauvegarder la carte hors ligne.",
                buttonNeutral: "Demander plus tard",
                buttonNegative: "Annuler",
                buttonPositive: "OK",
              }
            );
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
              await checkAndInitializeOfflineMap();
            }
          } else {
            await checkAndInitializeOfflineMap();
          }

          await AsyncStorage.setItem("isFirstLaunch", "false");
        }
        const storedLog = await AsyncStorage.getItem("isLog");
        if (storedLog === "true") {
          navigate.navigate("Categories");
        } else {
          await AsyncStorage.setItem("isLog", "false");
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
      }
    };

    initialize();
  }, []);

  const handleNextPress = async () => {
    if (!isMapDownloaded) {
      await downloadOfflineMap(); // Lance le téléchargement si non fait
      setIsMapDownloaded(true); // Marque le téléchargement comme terminé
    }
    navigate.navigate("Onboard2"); // Remplacez "NextPage" par la page cible
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.contentContainer}>
          <View style={styles.imageContainer}>
            <Image
              source={onboardImage1}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Faites des économies, pas des sacrifices !</Text>
            <Text style={styles.description}>
              Trouvez un appartement abordable avec toutes les caractéristiques
              dont vous avez besoin grâce à notre moteur de recherche
              intelligent.
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNextPress}>
          <Text style={styles.buttonText}>Suivant</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: height * 0.05, // 5% de la hauteur de l'écran
  },
  imageContainer: {
    width: "100%",
    height: height * 0.35, // 35% de la hauteur de l'écran
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: width * 0.8, // 80% de la largeur de l'écran
    height: "100%",
  },
  textContainer: {
    width: "100%",
    paddingHorizontal: width * 0.05, // 5% de la largeur de l'écran
    paddingTop: height * 0.05, // 5% de la hauteur de l'écran
  },
  title: {
    fontSize: Math.min(typography.title.fontSize, width * 0.06), // Adaptation de la taille du titre
    fontWeight: "bold",
    color: colors.title,
    textAlign: "center",
  },
  description: {
    paddingTop: height * 0.02,
    fontSize: Math.min(typography.text.fontSize, width * 0.04),
    color: colors.medium,
    textAlign: "center",
    lineHeight: Math.min(typography.text.fontSize * 1.5, width * 0.06),
  },
  footer: {
    width: "100%",
    height: height * 0.08, // 8% de la hauteur de l'écran
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Math.min(24, width * 0.06),
    fontWeight: "bold",
  },
});
