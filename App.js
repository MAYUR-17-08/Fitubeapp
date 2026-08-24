import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, Image, SafeAreaView, StatusBar, ScrollView 
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const GOOGLE_API_KEY = 'AIzaSyACjFc9br0-AoStWeNWl_dNybhXLl617Rc';
const STREAM_PROXIES = [
  'https://invidious.nerdvpn.de/api/v1/videos/',
  'https://vid.priv.au/api/v1/videos/',
  'https://inv.tux.pizza/api/v1/videos/'
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [homeSongs, setHomeSongs] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);

  const soundRef = useRef(new Audio.Sound());

  useEffect(() => {
    setupNativeAudio();
    loadStorageData();
    fetchSongs('Arijit Singh Audio Song', setHomeSongs);
  }, []);

  const setupNativeAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.log('Audio setup error', e);
    }
  };

  const loadStorageData = async () => {
    try {
      const rec = await AsyncStorage.getItem('fitube_recent');
      const lik = await AsyncStorage.getItem('fitube_liked');
      if (rec) setRecentSongs(JSON.parse(rec));
      if (lik) setLikedSongs(JSON.parse(lik));
    } catch (e) {}
  };

  const fetchSongs = async (query, setter) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.items) {
        const list = data.items.map(i => ({
          id: i.id.videoId,
          title: i.snippet.title.replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          artist: i.snippet.channelTitle,
          thumbnail: i.snippet.thumbnails.high?.url || i.snippet.thumbnails.default?.url
        }));
        setter(list);
      }
    } catch (e) {}
  };

  const getAudioUrl = async (id) => {
    for (let s of STREAM_PROXIES) {
      try {
        const res = await fetch(s + id);
        const data = await res.json();
        if (data?.adaptiveFormats) {
          const a = data.adaptiveFormats.filter(f => f.type?.includes('audio/mp4'));
          if (a.length > 0) return a[a.length - 1].url;
        }
      } catch (e) {}
    }
    return `https://pipedapi.kavin.rocks/streams/${id}`;
  };

  const playTrack = async (song) => {
    try {
      setCurrentSong(song);
      setIsPlaying(true);

      const updatedRecent = [song, ...recentSongs.filter(s => s.id !== song.id)].slice(0, 10);
      setRecentSongs(updatedRecent);
      AsyncStorage.setItem('fitube_recent', JSON.stringify(updatedRecent));

      await soundRef.current.unloadAsync();
      const directUrl = await getAudioUrl(song.id);
      await soundRef.current.loadAsync({ uri: directUrl }, { shouldPlay: true });
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) playNext();
      });
    } catch (e) {
      console.log('Playback error', e);
    }
  };

  const togglePlay = async () => {
    if (!currentSong) return;
    const status = await soundRef.current.getStatusAsync();
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    if (queue.length > 0) {
      const next = queue[0];
      setQueue(queue.slice(1));
      playTrack(next);
    } else if (homeSongs.length > 0) {
      playTrack(homeSongs[Math.floor(Math.random() * homeSongs.length)]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.logo}>Fitube Native Pro</Text>
      </View>

      {tab === 'home' && (
        <ScrollView style={styles.content}>
          <Text style={styles.secTitle}>Recently Played</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recentSongs}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.recCard} onPress={() => playTrack(item)}>
                <Image source={{ uri: item.thumbnail }} style={styles.recImg} />
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              </TouchableOpacity>
            )}
          />

          <Text style={styles.secTitle}>Trending Hits</Text>
          {homeSongs.map((item) => (
            <TouchableOpacity key={item.id} style={styles.songRow} onPress={() => playTrack(item)}>
              <Image source={{ uri: item.thumbnail }} style={styles.rowImg} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.songTitle}>{item.title}</Text>
                <Text style={styles.artistText}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {tab === 'search' && (
        <View style={styles.content}>
          <TextInput
            placeholder="Search songs, artists..."
            placeholderTextColor="#888"
            style={styles.searchBar}
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              if (t.length > 2) fetchSongs(t + ' audio song', setSearchResults);
            }}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.songRow} onPress={() => playTrack(item)}>
                <Image source={{ uri: item.thumbnail }} style={styles.rowImg} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.songTitle}>{item.title}</Text>
                  <Text style={styles.artistText}>{item.artist}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {currentSong && (
        <View style={styles.playerDock}>
          <Image source={{ uri: currentSong.thumbnail }} style={styles.dockImg} />
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text numberOfLines={1} style={styles.dockTitle}>{currentSong.title}</Text>
            <Text style={styles.artistText}>{currentSong.artist}</Text>
          </View>
          <TouchableOpacity onPress={togglePlay} style={{ padding: 10 }}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={playNext} style={{ padding: 10 }}>
            <Ionicons name="play-forward" size={24} color="#888" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('home')}>
          <Ionicons name="home" size={22} color={tab === 'home' ? '#1db954' : '#888'} />
          <Text style={{ color: tab === 'home' ? '#1db954' : '#888', fontSize: 11 }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('search')}>
          <Ionicons name="search" size={22} color={tab === 'search' ? '#1db954' : '#888'} />
          <Text style={{ color: tab === 'search' ? '#1db954' : '#888', fontSize: 11 }}>Search</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { padding: 16, borderBottomWidth: 1, borderColor: '#18181c' },
  logo: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 14 },
  secTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginVertical: 10 },
  recCard: { width: 120, marginRight: 12 },
  recImg: { width: 120, height: 120, borderRadius: 8 },
  cardTitle: { color: '#fff', fontSize: 12, marginTop: 4 },
  songRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#121215', padding: 8, borderRadius: 8 },
  rowImg: { width: 48, height: 48, borderRadius: 6, marginRight: 10 },
  songTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  artistText: { color: '#888', fontSize: 11, marginTop: 2 },
  searchBar: { backgroundColor: '#18181c', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 14 },
  playerDock: { position: 'absolute', bottom: 60, left: 8, right: 8, backgroundColor: '#18181c', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: '#222' },
  dockImg: { width: 44, height: 44, borderRadius: 6 },
  dockTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: '#09090b', flexDirection: 'row', borderTopWidth: 1, borderColor: '#18181c' },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
