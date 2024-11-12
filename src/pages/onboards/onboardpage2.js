import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Button,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from "react-native";
import onboardImage2 from "../../../assets/onboard1.png";
import colors from "../../constants/colors";
import typography from "../../constants/typo";
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get('window');

export default function Onboard2({ navigation }) {
  const navigate = useNavigation();
  
  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        <View style={styles.contentContainer}>
          <View style={styles.imageContainer}>
            <Image
              source={onboardImage2}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              Trouvez votre nouvel appartement
            </Text>
            <Text style={styles.description}>
              Profitez d'un service de recherche et d'annonce de logements
              abordables, permettant aux utilisateurs de filtrer les appartements
              par caractéristiques et de vendre rapidement leur propriété
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigate.navigate("Categories")}
        >
          <Text style={styles.buttonText}>
            Démarrer
          </Text>
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
    alignItems: 'center',
    paddingTop: height * 0.05, // 5% de la hauteur de l'écran
  },
  imageContainer: {
    width: '100%',
    height: height * 0.35, // 35% de la hauteur de l'écran
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: height * 0.02,
  },
  image: {
    width: width * 0.8, // 80% de la largeur de l'écran
    height: '100%',
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: width * 0.05, // 5% de la largeur de l'écran
    paddingTop: height * 0.05, // 5% de la hauteur de l'écran
  },
  title: {
    fontSize: Math.min(typography.title.fontSize, width * 0.06),
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
    paddingHorizontal: width * 0.05,
  },
  footer: {
    width: '100%',
    height: height * 0.08, // 8% de la hauteur de l'écran
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Math.min(24, width * 0.06),
    fontWeight: "bold",
  },
});