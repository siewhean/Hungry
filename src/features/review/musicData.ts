export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string; // 30s preview URL
  duration: number;
}

export const TRENDING_MUSIC: MusicTrack[] = [
  {
    id: "m1",
    title: "Hawker Hustle",
    artist: "SG Beats",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 30,
  },
  {
    id: "m2",
    title: "Chilli Crab Vibe",
    artist: "Island Grooves",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 30,
  },
  {
    id: "m3",
    title: "Satay Night",
    artist: "Midnight Makan",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 30,
  },
  {
    id: "m4",
    title: "Kopi O Morning",
    artist: "Traditionalist",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    duration: 30,
  },
  {
    id: "m5",
    title: "Durian Dream",
    artist: "Tropical Fruits",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    duration: 30,
  },
];
