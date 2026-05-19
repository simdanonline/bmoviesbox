import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Focusable from '../components/Focusable';
import { StreamingServer } from '../services/MovieAPI';
import { styles } from '../styles/styles';

type ServerSelectionScreenProps = NativeStackScreenProps<any, 'ServerSelection'>;

export default function ServerSelectionScreen({
  route,
  navigation,
}: ServerSelectionScreenProps) {
  const { servers, movieTitle } = route.params as {
    servers: StreamingServer[];
    movieTitle: string;
  };

  const handleServerSelect = (server: StreamingServer) => {
    navigation.navigate('VideoPlayer', {
      server,
      movieTitle,
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.serverSelectionContainer}>
        <Text style={styles.sectionTitle}>Available Servers</Text>
        <Text style={styles.subtext}>
          Select a server to play "{movieTitle}"
        </Text>

        <View style={styles.serversGrid}>
          {servers.map((server, index) => (
            <Focusable
              key={index}
              style={styles.serverCard}
              onPress={() => handleServerSelect(server)}
              hasTVPreferredFocus={index === 0}
            >
              <Text style={styles.serverName}>{server.serverName || server.name}</Text>
              {server.quality && (
                <Text style={styles.serverQuality}>{server.quality}</Text>
              )}
              <Text style={styles.serverNumber}>Server {server.serverNumber || index + 1}</Text>
            </Focusable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
