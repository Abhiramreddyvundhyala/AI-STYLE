export type Style = {
  id: number;
  name: string;
  creator: string;
  price: number;
  rating: number;
  sales: string;
  category: string;
  image: string;
  description?: string;
  tags?: string[];
};

export const categories = [
  "All", "Cinematic", "Bollywood", "Cartoon", "Wedding",
  "Festival", "Business", "Viral", "Portrait",
];

export const styles: Style[] = [
  { id:1, name:"KGF Dark Cinematic", creator:"raj_creates", price:99, rating:4.9, sales:"2.1k", category:"Cinematic", image:"https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800" },
  { id:2, name:"Bollywood Poster Style", creator:"priya_art", price:149, rating:4.8, sales:"1.8k", category:"Bollywood", image:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800" },
  { id:3, name:"Pixar Character Avatar", creator:"toon_studio", price:199, rating:4.9, sales:"3.2k", category:"Cartoon", image:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800" },
  { id:4, name:"Royal Mughal Portrait", creator:"heritage_ai", price:249, rating:4.7, sales:"987", category:"Portrait", image:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800" },
  { id:5, name:"Neon Cyberpunk City", creator:"neon_vibes", price:79, rating:4.6, sales:"1.4k", category:"Viral", image:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800" },
  { id:6, name:"Wedding Cinematic", creator:"weddingai_in", price:299, rating:5.0, sales:"4.1k", category:"Wedding", image:"https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800" },
  { id:7, name:"Festival Glow Look", creator:"festive_fx", price:49, rating:4.5, sales:"2.7k", category:"Festival", image:"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800" },
  { id:8, name:"Studio Pro Portrait", creator:"studio_lens", price:179, rating:4.8, sales:"1.1k", category:"Business", image:"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800" },
  { id:9, name:"Vintage Film Poster", creator:"retro_raj", price:129, rating:4.7, sales:"876", category:"Cinematic", image:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800" },
  { id:10, name:"Newspaper Hero Style", creator:"press_ai", price:89, rating:4.6, sales:"654", category:"Viral", image:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800" },
  { id:11, name:"Cartoon Caricature", creator:"desi_toons", price:159, rating:4.9, sales:"2.3k", category:"Cartoon", image:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800" },
  { id:12, name:"Diwali Glow Portrait", creator:"festive_fx", price:69, rating:4.8, sales:"3.5k", category:"Festival", image:"https://images.unsplash.com/photo-1521119989659-a83eee488004?w=800" },
].map(s => ({
  ...s,
  description: "A premium AI style crafted by top creators. Transforms your photo with cinematic lighting, mood, and detail in seconds.",
  tags: ["#cinematic", "#portrait", "#trending", `#${s.category.toLowerCase()}`],
}));
