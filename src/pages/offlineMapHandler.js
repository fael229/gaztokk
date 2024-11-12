import { useEffect } from 'react';
import Mapbox, { offlineManager, StyleURL } from "@rnmapbox/maps";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Dimensions } from 'react-native';
import geoViewport from '@mapbox/geo-viewport';

const OFFLINE_MAP_KEY = 'BENIN_OFFLINE_MAP';
const MAP_DOWNLOAD_STATUS = 'MAP_DOWNLOAD_STATUS';

// Coordonnées et configurations pour le Bénin
const BENIN_CENTER_COORD = [2.3158, 9.3077]; // Coordonnée centrale du Bénin
const MAPBOX_VECTOR_TILE_SIZE = 512;
const BENIN_BOUNDS = {
  minZoom: 10,
  maxZoom: 15,
};

export const useOfflineMap = () => {
  const downloadOfflineMap = async () => {
    try {
      const isDownloaded = await AsyncStorage.getItem(MAP_DOWNLOAD_STATUS);
      if (isDownloaded === 'true') {
        console.log('Carte déjà téléchargée');
        return;
      }

      console.log("Initialisation du téléchargement de la carte...");

      // Calculer les limites géographiques pour le téléchargement de la carte
      const { width, height } = Dimensions.get('window');
      const bounds = geoViewport.bounds(
        BENIN_CENTER_COORD,
        BENIN_BOUNDS.minZoom,
        [width, height],
        MAPBOX_VECTOR_TILE_SIZE
      );

      // Créer les options pour le téléchargement
      const options = {
        name: OFFLINE_MAP_KEY,
        styleURL: StyleURL.Streets, // Utiliser une constante Mapbox pour l'URL du style
        bounds: [
          [bounds[0], bounds[1]], // Sud-Ouest
          [bounds[2], bounds[3]], // Nord-Est
        ],
        minZoom: BENIN_BOUNDS.minZoom,
        maxZoom: BENIN_BOUNDS.maxZoom,
        metadata: {
          region: "Bénin",
          purpose: "utilisation hors ligne",
        },
      };

      // Vérifiez que `styleURL` est bien défini
      if (!options.styleURL) {
        throw new Error("URL de style manquante pour la création du pack hors ligne.");
      }

      // Créer le pack hors ligne avec gestion de progression
      offlineManager.createPack(
        options,
        async (region, status) => {
          if (status.percentage === 100) {
            await AsyncStorage.setItem(MAP_DOWNLOAD_STATUS, 'true');
            console.log('Téléchargement de la carte terminé');
            Alert.alert(
              'Succès',
              'La carte du Bénin a été téléchargée avec succès pour une utilisation hors ligne.'
            );
          } else {
            console.log(`Progression du téléchargement : ${status.percentage}%`);
          }
        },
        (region, error) => {
          console.error('Erreur lors du téléchargement :', error);
          Alert.alert(
            'Erreur',
            'Une erreur est survenue lors du téléchargement de la carte.'
          );
        }
      );

    } catch (error) {
      console.error("Erreur lors de l'initialisation du téléchargement :", error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de l\'initialisation du téléchargement.'
      );
    }
  };

  const checkAndInitializeOfflineMap = async () => {
    try {
      const packs = await offlineManager.getPacks();
      const offlinePack = packs.find(pack => pack.name === OFFLINE_MAP_KEY);
      
      if (!offlinePack) {
        Alert.alert(
          'Téléchargement de carte',
          'Pour utiliser l\'application hors ligne, nous devons télécharger la carte du Bénin. Voulez-vous la télécharger maintenant ?',
          [
            {
              text: 'Plus tard',
              style: 'cancel'
            },
            {
              text: 'Télécharger',
              onPress: downloadOfflineMap
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des cartes hors ligne:', error);
    }
  };

  const clearOfflineMap = async () => {
    try {
      await offlineManager.resetDatabase();
      await AsyncStorage.removeItem(MAP_DOWNLOAD_STATUS);
      console.log('Carte hors ligne supprimée');
    } catch (error) {
      console.error('Erreur lors de la suppression de la carte:', error);
    }
  };

  return {
    downloadOfflineMap,
    checkAndInitializeOfflineMap,
    clearOfflineMap
  };
};
