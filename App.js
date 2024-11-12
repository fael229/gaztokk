import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Onboard1 from "./src/pages/onboards/onboardpage1";
import Onboard2 from "./src/pages/onboards/onboardpage2";
import Addvendor from "./src/pages/vendorsadd";
import Mapi from "./src/pages/mapi";
import ModalScreen from "./src/pages/rrr";
import Checkout from "./src/pages/checkout";
import NearbyVendors1 from "./src/pages/mapi";
import { Provider as PaperProvider } from "react-native-paper";
import Categories from "./src/pages/categories";
import VendorContent from "./src/pages/VendorContent";
import Compare from "./src/pages/compare";
import VendorListings from "./src/pages/VendorListings";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const storedLog = await AsyncStorage.getItem("isLog");
      if (storedLog === "true") {
        setInitialRoute("Categories");
      } else {
        setInitialRoute("Onboard1");
      }
    };

    checkLoginStatus();
  }, []);

  if (initialRoute === null) {
    // Return null or a loading spinner while checking the login status
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Onboard1" component={Onboard1} />
      <Stack.Screen name="Onboard2" component={Onboard2} />
      <Stack.Screen name="Addvendor" component={Addvendor} />
      <Stack.Screen name="NearbyVendors1" component={NearbyVendors1} />
      <Stack.Screen name="ModalScreen" component={ModalScreen} />
      <Stack.Screen name="Checkout" component={Checkout} />
      <Stack.Screen name="Mapi" component={Mapi} />
      <Stack.Screen name="Categories" component={Categories} />
      <Stack.Screen name="VendorContent" component={VendorContent} />
      <Stack.Screen name="Compare" component={Compare} />
      <Stack.Screen name="VendorListings" component={VendorListings} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
}
