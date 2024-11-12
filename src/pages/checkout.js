import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Appbar } from "react-native-paper";
import axios from "axios";
import CenteredModalPicker from "../components/modalview";
import { Modal, Portal } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "./supabase"; // Import Supabase client
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import colors from "../constants/colors";
import ExpoStatusBar from "expo-status-bar/build/ExpoStatusBar";

const CustomPicker = ({ selectedValue, onValueChange, items }) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Trouver le label correspondant à la valeur sélectionnée pour l'affichage
  const selectedItem = items.find((item) => item.value === selectedValue);
  const displayLabel = selectedItem ? selectedItem.label : "";

  return (
    <View>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: colors.title, fontWeight: "bold", fontSize: 16 }}>
          {displayLabel}
        </Text>
      </TouchableOpacity>
      <CenteredModalPicker
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        items={items}
        onValueChange={(value) => {
          onValueChange(value);
          setModalVisible(false);
        }}
      />
    </View>
  );
};

// Composant pour afficher le statut du paiement dans un modal
const PaymentStatusModal = ({ visible, status, onDismiss }) => {
  const navigation = useNavigation();
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Text style={styles.modalText}>Le paiement est {status}</Text>
        <TouchableOpacity
          style={styles.modalButton}
          onPress={() => {
            onDismiss();
            navigation.goBack();
          }}
        >
          <Text style={styles.modalButtonText}>Fermer</Text>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
};

const Checkout = ({ route }) => {
  const navigation = useNavigation();
  const { vendor, product } = route.params;
  const [quantity, setQuantity] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState("mtn_open");
  const [transactionId, setTransactionId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [paymentStatusModalVisible, setPaymentStatusModalVisible] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // État pour l'indicateur de chargement

  const totalPrice = quantity * product.price;

  // Fonction pour générer et partager le PDF
  const generateAndSharePDF = async () => {
    const htmlContent = `
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            width: 80%;
            margin: auto;
            padding: 20px;
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
          }
          h1 {
            text-align: center;
            color: #333;
            border-bottom: 2px solid #0d6efd;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .details {
            margin-bottom: 30px;
          }
          .details p {
            font-size: 14px;
            line-height: 1.6;
            margin: 8px 0;
            color: #555;
          }
          .details strong {
            color: #333;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .summary-table th, .summary-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          .summary-table th {
            background-color: #0d6efd;
            color: white;
          }
          .summary-table td {
            background-color: #f9f9f9;
          }
          .total {
            text-align: right;
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #888;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Facture de Commande</h1>
          <div class="details">
            <p><strong>Vendeur :</strong> ${vendor.name}</p>
            <p><strong>Produit :</strong> ${product.brand} - ${product.type}</p>
            <p><strong>Prix unitaire :</strong> ${product.price} XOF</p>
            <p><strong>Quantité :</strong> ${quantity}</p>
            <p><strong>Client :</strong> ${firstname} ${lastname}</p>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Téléphone :</strong> +229${phoneNumber}</p>
            <p><strong>Opérateur :</strong> ${
              operator === "mtn_open" ? "mtn" : "Moov"
            }</p>
            <p><strong>ID de Transaction :</strong> ${transactionId}</p>
            <p><strong>Date :</strong> ${new Date().toLocaleString()}</p>
          </div>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Prix total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${product.brand} - ${product.type}</td>
                <td>${quantity}</td>
                <td>${product.price} XOF</td>
                <td>${totalPrice} XOF</td>
              </tr>
            </tbody>
          </table>
          <p class="total">Total : ${totalPrice} XOF</p>
          <div class="footer">
            <p>Merci pour votre achat chez GAZTOK !</p>
            <p>Contactez-nous en cas de besoin : +229 01 67 21 42 25</p>
          </div>
        </div>
      </body>
    </html>
    `;

    try {
      // Générer le PDF avec un nom temporaire
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
      });

      console.log("PDF généré à:", uri);

      // Définir le nouvel emplacement et nom du fichier
      const newFilePath = `${
        FileSystem.documentDirectory
      }facture_GAZTOK_${new Date().toLocaleString()}.pdf`;

      // Déplacer le fichier à l'emplacement souhaité avec le nouveau nom
      await FileSystem.moveAsync({
        from: uri,
        to: newFilePath,
      });

      console.log("Fichier renommé à:", newFilePath);

      // Partager le PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newFilePath);
      } else {
        Alert.alert(
          "Erreur",
          "Le partage n'est pas disponible sur cette plateforme"
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de la génération ou du partage du PDF:",
        error
      );
      Alert.alert(
        "Erreur",
        "Une erreur est survenue lors de la génération de la facture."
      );
    }
  };

  // Charger les infos depuis le cache lors du premier montage du composant
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const storedFirstname = await AsyncStorage.getItem("firstname");
        const storedLastname = await AsyncStorage.getItem("lastname");
        const storedEmail = await AsyncStorage.getItem("email");
        const storedPhoneNumber = await AsyncStorage.getItem("phoneNumber");
        const storedOperator = await AsyncStorage.getItem("operator");

        if (storedFirstname) setFirstname(storedFirstname);
        if (storedLastname) setLastname(storedLastname);
        if (storedEmail) setEmail(storedEmail);
        if (storedPhoneNumber) setPhoneNumber(storedPhoneNumber);
        if (storedOperator) setOperator(storedOperator);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des infos utilisateur :",
          error
        );
      }
    };

    loadUserInfo();
  }, []);

  // Fonction pour enregistrer les infos dans AsyncStorage
  const saveUserInfo = async () => {
    try {
      await AsyncStorage.setItem("firstname", firstname);
      await AsyncStorage.setItem("lastname", lastname);
      await AsyncStorage.setItem("email", email);
      await AsyncStorage.setItem("phoneNumber", phoneNumber);
      await AsyncStorage.setItem("operator", operator);
    } catch (error) {
      console.error(
        "Erreur lors de l'enregistrement des infos utilisateur :",
        error
      );
    }
  };

  // Fonction pour créer un délai (utilisé dans le polling)
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Fonction de polling pour vérifier le statut de la transaction
  const pollTransactionStatus = async (
    transactionId,
    maxAttempts = 10,
    interval = 5000
  ) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `https://api.fedapay.com/v1/transactions/${transactionId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer sk_live_-1dFz75QX2my3HVaWzqXyzWv",
            },
          }
        );

        const status = response.data["v1/transaction"].status;
        console.log(`Tentative ${attempt}: Statut du paiement: ${status}`);

        if (status.trim().toLowerCase() === "approved") {
          return { status: "approved", data: response.data };
        } else if (
          status.trim().toLowerCase() === "failed" ||
          status.trim().toLowerCase() === "cancelled"
        ) {
          return { status: "failed", data: response.data };
        }

        // Attendre avant la prochaine tentative
        await delay(interval);
      } catch (error) {
        console.error(
          `Erreur lors de la vérification du statut (tentative ${attempt}):`,
          error
        );
        // Vous pouvez décider de continuer ou d'arrêter en cas d'erreur
        await delay(interval);
      }
    }

    // Si le statut reste "pending" après toutes les tentatives
    return { status: "pending", data: null };
  };
  const pollTransactionStatus1 = async (
    transactionId,
    maxAttempts = 10,
    interval = 5000
  ) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `https://sandbox-api.fedapay.com/v1/transactions/${transactionId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer sk_sandbox_46Y0uIx1R_aGt66QOE9qJ9ku",
            },
          }
        );

        const status = response.data["v1/transaction"].status;
        console.log(`Tentative ${attempt}: Statut du paiement: ${status}`);

        if (status.trim().toLowerCase() === "approved") {
          return { status: "approved", data: response.data };
        } else if (
          status.trim().toLowerCase() === "failed" ||
          status.trim().toLowerCase() === "cancelled"
        ) {
          return { status: "failed", data: response.data };
        }

        // Attendre avant la prochaine tentative
        await delay(interval);
      } catch (error) {
        console.error(
          `Erreur lors de la vérification du statut (tentative ${attempt}):`,
          error
        );
        // Vous pouvez décider de continuer ou d'arrêter en cas d'erreur
        await delay(interval);
      }
    }

    // Si le statut reste "pending" après toutes les tentatives
    return { status: "pending", data: null };
  };

  // Fonction pour gérer la confirmation et l'appel de la génération du PDF
  const confirmAndGeneratePDF = () => {
    Alert.alert(
      "Télécharger la facture",
      "Voulez-vous télécharger la facture en PDF?",
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Télécharger",
          onPress: () => generateAndSharePDF(), // Appel de la génération du PDF
        },
      ],
      { cancelable: true }
    );
  };

  // Fonction principale pour gérer le paiement
  const handlePayment = async () => {
    // Validation des champs requis
    if (!phoneNumber || !firstname || !lastname || !email) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs requis.");
      return;
    }

    setIsProcessing(true); // Démarrer l'indicateur de chargement

    const transactionData = {
      description: "Transaction for john.doe@example.com",
      amount: totalPrice,
      currency: { iso: "XOF" },
      callback_url: "https://maplateforme.com/callback",
      customer: {
        firstname: firstname,
        lastname: lastname,
        email: email,
        phone_number: {
          number: `+229${phoneNumber}`,
          country: "bj",
        },
      },
    };

    try {
      // Créer la transaction
      const response = await axios.post(
        "https://api.fedapay.com/v1/transactions",
        transactionData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_live_-1dFz75QX2my3HVaWzqXyzWv",
          },
        }
      );

      const transactionId = response.data["v1/transaction"].id;
      console.log("ID de Transaction:", transactionId);
      setTransactionId(transactionId);

      // Obtenir le token
      const tokenResponse = await axios.post(
        `https://api.fedapay.com/v1/transactions/${transactionId}/token`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_live_-1dFz75QX2my3HVaWzqXyzWv",
          },
        }
      );
      const token = tokenResponse.data.token;
      console.log("Token:", token);
      setToken(token);

      // Effectuer le paiement via l'opérateur choisi
      await axios.post(
        `https://api.fedapay.com/v1/${operator}`,
        {
          token: token,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_live_-1dFz75QX2my3HVaWzqXyzWv",
          },
        }
      );

      // Démarrer le polling pour vérifier le statut de la transaction
      const pollingResult = await pollTransactionStatus(transactionId);

      if (pollingResult.status === "approved") {
        console.log("Paiement effectué avec succès !");

        // Insérer les données dans Supabase
        const { data: donnee, error } = await supabase
          .from("approved_orders")
          .insert([
            {
              vendor_name: vendor.name,
              vendor_tel: vendor.tel,
              product_brand: product.brand,
              product_type: product.type,
              total_price: totalPrice,
              quantity: quantity,
              phone_number: phoneNumber,
              distance: product.distance,
              user_loc: product.userLoc,
              vendor_loc: product.vendorLoc,
              client_name: lastname,
              client_phone: phoneNumber,
            },
          ]);

        if (error) {
          console.error("Erreur lors de l'insertion dans Supabase:", error);
        } else {
          console.log("Données insérées avec succès:", donnee);
        }

        // Confirmer avant de générer le PDF
        confirmAndGeneratePDF();

        // Sauvegarder les infos utilisateur
        saveUserInfo();

        // Afficher le modal de statut de paiement
        setPaymentStatus("approuvé");
        setPaymentStatusModalVisible(true);
      } else if (pollingResult.status === "failed") {
        console.log("Paiement échoué. Veuillez réessayer.");
        Alert.alert("Erreur", "Le paiement a échoué. Veuillez réessayer.");
      } else {
        console.log(
          "Le paiement est toujours en attente. Veuillez réessayer plus tard."
        );
        Alert.alert(
          "En attente",
          "Le paiement est toujours en attente. Veuillez réessayer plus tard."
        );
      }
    } catch (error) {
      console.error("Erreur lors du processus de paiement:", error);
      Alert.alert("Erreur", "Erreur de paiement. Veuillez réessayer.");
    } finally {
      setIsProcessing(false); // Arrêter l'indicateur de chargement
    }
  };
  const handlePayment1 = async () => {
    // Validation des champs requis
    if (!phoneNumber || !firstname || !lastname || !email) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs requis.");
      return;
    }

    setIsProcessing(true); // Démarrer l'indicateur de chargement

    const transactionData = {
      description: "Transaction for john.doe@example.com",
      amount: totalPrice,
      currency: { iso: "XOF" },
      callback_url: "https://maplateforme.com/callback",
      customer: {
        firstname: firstname,
        lastname: lastname,
        email: email,
        phone_number: {
          number: `+229${phoneNumber}`,
          country: "bj",
        },
      },
    };

    try {
      // Créer la transaction
      const response = await axios.post(
        "https://sandbox-api.fedapay.com/v1/transactions",
        transactionData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_sandbox_46Y0uIx1R_aGt66QOE9qJ9ku",
          },
        }
      );

      const transactionId = response.data["v1/transaction"].id;
      console.log("ID de Transaction:", transactionId);
      setTransactionId(transactionId);

      // Obtenir le token
      const tokenResponse = await axios.post(
        `https://sandbox-api.fedapay.com/v1/transactions/${transactionId}/token`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_sandbox_46Y0uIx1R_aGt66QOE9qJ9ku",
          },
        }
      );
      const token = tokenResponse.data.token;
      console.log("Token:", token);
      setToken(token);

      // Effectuer le paiement via l'opérateur choisi
      await axios.post(
        `https://sandbox-api.fedapay.com/v1/${operator}`,
        {
          token: token,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer sk_sandbox_46Y0uIx1R_aGt66QOE9qJ9ku",
          },
        }
      );

      // Démarrer le polling pour vérifier le statut de la transaction
      const pollingResult = await pollTransactionStatus1(transactionId);

      if (pollingResult.status === "approved") {
        console.log("Paiement effectué avec succès !");

        // Insérer les données dans Supabase
        const { data: donnee, error } = await supabase
          .from("approved_orders")
          .insert([
            {
              vendor_name: vendor.name,
              vendor_tel: vendor.tel,
              product_brand: product.brand,
              product_type: product.type,
              total_price: totalPrice,
              quantity: quantity,
              phone_number: phoneNumber,
              distance: product.distance,
              user_loc: product.userLoc,
              vendor_loc: product.vendorLoc,
              client_name: lastname,
              client_phone: phoneNumber,
            },
          ]);

        if (error) {
          console.error("Erreur lors de l'insertion dans Supabase:", error);
        } else {
          console.log("Données insérées avec succès:", donnee);
        }

        // Confirmer avant de générer le PDF
        confirmAndGeneratePDF();

        // Sauvegarder les infos utilisateur
        saveUserInfo();

        // Afficher le modal de statut de paiement
        setPaymentStatus("approuvé");
        setPaymentStatusModalVisible(true);
      } else if (pollingResult.status === "failed") {
        console.log("Paiement échoué. Veuillez réessayer.");
        Alert.alert("Erreur", "Le paiement a échoué. Veuillez réessayer.");
      } else {
        console.log(
          "Le paiement est toujours en attente. Veuillez réessayer plus tard."
        );
        Alert.alert(
          "En attente",
          "Le paiement est toujours en attente. Veuillez réessayer plus tard."
        );
      }
    } catch (error) {
      console.error("Erreur lors du processus de paiement:", error);
      Alert.alert("Erreur", "Erreur de paiement. Veuillez réessayer.");
    } finally {
      setIsProcessing(false); // Arrêter l'indicateur de chargement
    }
  };

  // Fonction pour masquer le modal de statut de paiement
  const hidePaymentStatusModal = () => setPaymentStatusModalVisible(false);

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Checkout" />
      </Appbar.Header>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Résumé de la commande</Text>
        <Text style={styles.vendorName}>{vendor.name}</Text>
        <Text style={styles.productInfo}>
          {product.brand} - {product.type}
        </Text>
        <Text style={styles.price}>Prix unitaire : {product.price} XOF</Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={styles.quantityLabel}>Quantité :</Text>
          <CustomPicker
            selectedValue={quantity}
            onValueChange={(itemValue) => setQuantity(itemValue)}
            items={[
              { label: "1", value: 1 },
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
              { label: "5", value: 5 },
            ]}
          />
        </View>

        <Text style={styles.phoneNumberLabel}>Numéro de téléphone :</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre numéro de téléphone"
          keyboardType="numeric"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <Text style={styles.firstnameLabel}>Prénom :</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre prénom"
          value={firstname}
          onChangeText={setFirstname}
        />

        <Text style={styles.lastnameLabel}>Nom :</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre nom"
          value={lastname}
          onChangeText={setLastname}
        />

        <Text style={styles.emailLabel}>Email :</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez votre email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={styles.operatorLabel}>Opérateur :</Text>
          <CustomPicker
            selectedValue={operator}
            onValueChange={(itemValue) => setOperator(itemValue)}
            items={[
              { label: "mtn", value: "mtn_open" }, // Label modifié ici
              { label: "Moov", value: "moov" },
            ]}
          />
        </View>

        <Text style={styles.totalPrice}>Prix total : {totalPrice} XOF</Text>

        <TouchableOpacity style={styles.orderButton} onPress={handlePayment1}>
          <Text style={styles.orderButtonText}>Payer avec Fedapay</Text>
        </TouchableOpacity>

        <PaymentStatusModal
          visible={paymentStatusModalVisible}
          status={paymentStatus}
          onDismiss={hidePaymentStatusModal}
        />
      </ScrollView>

      {/* Indicateur de chargement pendant le traitement du paiement */}
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Traitement du paiement...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    backgroundColor: "white",
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 10,
    paddingVertical: 15,
    marginBottom: 10,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    width: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: colors.primary,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  productInfo: {
    fontSize: 16,
    marginBottom: 5,
  },
  price: {
    fontSize: 16,
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  phoneNumberLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  firstnameLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  lastnameLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  emailLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  operatorLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 30,
  },
  orderButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 30,
  },
  orderButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  modalText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 20,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  loadingText: {
    marginTop: 10,
    color: "white",
    fontSize: 16,
  },
});

export default Checkout;
