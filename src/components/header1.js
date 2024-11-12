import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors'; // Adjust the import path as needed

const Header1 = ({ title, onBackPress }) => {
  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
        >
          <Ionicons name="chevron-back" size={30} color={colors.title} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{title}</Text>
      </View>
      {/* <View style={styles.divider}></View> */}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center', // Adjust as needed
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 10,
  },
  headerText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
    paddingBottom: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginBottom: 8,
    marginTop: 10,
  },
});

export default Header1;