"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Search, CheckCircle, Trash2, Edit2, X, Scan,
  ChevronDown, ChevronUp, Clock, Flame, AlertTriangle, Settings, Image as ImageIcon
} from "lucide-react";
import { merchantMutationFetch } from "@/lib/merchantPortal/csrf";
import { parseMerchantPortalJson } from "@/lib/merchantPortal/fetch";
import styles from "../../console/console.module.css";

interface Dish {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
  isSoldOut: boolean;
  isFeatured: boolean;
  imageUrl: string;
  dietary: string[];
  ingredients: string[];
  calories: number;
  prepTime: string;
  spiciness: number; // 0 to 4
  allergens: string[];
  tasteProfile: {
    sweet: number;
    spicy: number;
    sour: number;
    salty: number;
    rich: number;
    aromatic: number;
  };
}

type MerchantMenuApiResponse = {
  dishes?: Partial<Dish>[];
  error?: string;
};

function normalizeDish(row: Partial<Dish>): Dish {
  return {
    allergens: row.allergens ?? [],
    calories: row.calories ?? 0,
    category: row.category ?? "Menu",
    description: row.description ?? "",
    dietary: row.dietary ?? [],
    id: row.id ?? `dish-${Date.now()}`,
    imageUrl: row.imageUrl ?? "",
    ingredients: row.ingredients ?? [],
    isFeatured: Boolean(row.isFeatured),
    isSoldOut: Boolean(row.isSoldOut),
    name: row.name ?? "Untitled dish",
    prepTime: row.prepTime ?? "Listed",
    price: row.price ?? "S$0.00",
    spiciness: row.spiciness ?? 0,
    tasteProfile: row.tasteProfile ?? { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
  };
}

const PRESET_PHOTOS = [
  { name: "Hainanese Chicken Rice", url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80" },
  { name: "Lor Mee Noodles", url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80" },
  { name: "Wok-Hei Char Kway Teow", url: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80" },
  { name: "Fuzhou Oyster Cake", url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80" },
  { name: "Spicy Chili Crab", url: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&q=80" },
  { name: "Hawker Satay Skewers", url: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80" },
  { name: "Singapore Laksa Soup", url: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&q=80" },
  { name: "Fragrant Nasi Lemak", url: "https://images.unsplash.com/photo-1632203171982-cc0df6e9ceb4?w=500&q=80" },
  { name: "Flaky Roti Prata", url: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=500&q=80" },
  { name: "Mango Shaved Ice", url: "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=500&q=80" },
  { name: "Fresh Barley Water", url: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&q=80" },
  { name: "Teh Tarik Milk Tea", url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80" },
];

const INITIAL_DISHES: Dish[] = [
  {
    id: "d1",
    name: "Fuzhou Oyster Cake",
    price: "S$3.00",
    category: "Snacks",
    description: "Crispy outer crust packed with plump, juicy oysters, fresh minced pork, cilantro, and crunchy roasted peanuts.",
    isSoldOut: false,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80",
    dietary: ["Seafood"],
    ingredients: ["Fresh Oysters", "Minced Pork", "Cilantro", "Roasted Peanuts", "Rice Batter Flour"],
    calories: 290,
    prepTime: "5 mins",
    spiciness: 0,
    allergens: ["Peanuts", "Seafood", "Gluten"],
    tasteProfile: { sweet: 2, spicy: 0, sour: 1, salty: 6, rich: 7, aromatic: 8 }
  },
  {
    id: "d2",
    name: "Lor Mee Noodles",
    price: "S$4.50",
    category: "Noodles",
    description: "Thick yellow noodles served in a rich, five-spiced braised gravy, topped with deep-fried fish nuggets, meat rolls, and garlic.",
    isSoldOut: false,
    isFeatured: true,
    imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80",
    dietary: [],
    ingredients: ["Flat Yellow Noodles", "Five-Spice Thick Gravy", "Crispy Fish Pieces", "Ngoh Hiang Roll", "Hard-boiled Egg", "Black Vinegar", "Garlic Paste"],
    calories: 520,
    prepTime: "8 mins",
    spiciness: 2,
    allergens: ["Gluten", "Egg", "Fish"],
    tasteProfile: { sweet: 3, spicy: 5, sour: 6, salty: 7, rich: 8, aromatic: 8 }
  },
  {
    id: "d3",
    name: "Wok-Hei Char Kway Teow",
    price: "S$5.00",
    category: "Noodles",
    description: "Stir-fried flat rice noodles cooked over intense wok-fire with sweet dark soy sauce, fresh cockles, Chinese sausage, egg, and lard.",
    isSoldOut: true,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80",
    dietary: [],
    ingredients: ["Flat Rice Noodles", "Fresh Cockles", "Lap Cheong (Sausage)", "Egg", "Bean Sprouts", "Pork Lard", "Thick Sweet Dark Soy Sauce"],
    calories: 740,
    prepTime: "10 mins",
    spiciness: 3,
    allergens: ["Gluten", "Shellfish", "Egg", "Soy"],
    tasteProfile: { sweet: 7, spicy: 6, sour: 1, salty: 8, rich: 9, aromatic: 9 }
  },
  {
    id: "d4",
    name: "Hainanese Chicken Rice",
    price: "S$4.80",
    category: "Rice",
    description: "Poached tender chicken seasoned with light soy, served with fragrant chicken oil rice, spicy homemade ginger chili, and cucumber.",
    isSoldOut: false,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    dietary: ["Halal"],
    ingredients: ["Poached Free-Range Chicken", "Fragrant Jasmine Rice", "Ginger", "Garlic", "Homemade Chili Sauce", "Cucumber Slices", "Sesame Oil"],
    calories: 610,
    prepTime: "5 mins",
    spiciness: 2,
    allergens: ["Soy", "Sesame", "Gluten"],
    tasteProfile: { sweet: 2, spicy: 4, sour: 3, salty: 6, rich: 7, aromatic: 9 }
  },
  {
    id: "d5",
    name: "Crispy Roast Pork Rice",
    price: "S$5.50",
    category: "Rice",
    description: "Thick cuts of succulent roasted pork belly with an ultra-crispy skin crackling, served over white rice with sticky sweet dark soy sauce.",
    isSoldOut: false,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    dietary: [],
    ingredients: ["Roasted Crispy Pork Belly", "Jasmine Rice", "Sweet Dipping Chili", "Thick Dark Soy Sauce", "Pickled Cucumbers"],
    calories: 680,
    prepTime: "6 mins",
    spiciness: 2,
    allergens: ["Soy", "Gluten"],
    tasteProfile: { sweet: 4, spicy: 3, sour: 2, salty: 8, rich: 8, aromatic: 7 }
  },
  {
    id: "d6",
    name: "Fresh Barley Water",
    price: "S$1.80",
    category: "Drinks",
    description: "Homemade refreshing barley water boiled daily with high-quality barley pearl grains and sweetened lightly with rock sugar.",
    isSoldOut: false,
    isFeatured: false,
    imageUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&q=80",
    dietary: ["Vegan", "Vegetarian", "Healthy Choice"],
    ingredients: ["High-grade Barley Pearls", "Pure Water", "Rock Sugar", "Candied Winter Melon"],
    calories: 120,
    prepTime: "2 mins",
    spiciness: 0,
    allergens: ["Gluten"],
    tasteProfile: { sweet: 4, spicy: 0, sour: 0, salty: 1, rich: 2, aromatic: 5 }
  },
];

export default function MerchantMenuPage() {
  const [dishes, setDishes] = useState<Dish[]>(INITIAL_DISHES);
  const [categories, setCategories] = useState<string[]>(["Rice", "Noodles", "Snacks", "Drinks"]);
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advanced feature states
  const [expandedDishes, setExpandedDishes] = useState<Record<string, boolean>>({});
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [deleteReassignCat, setDeleteReassignCat] = useState<string>("delete_all");

  // Image Selector Drawer State
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<"add" | "edit">("add");
  const [customImageUrlInput, setCustomImageUrlInput] = useState("");

  // Advanced dish form state
  const initialForm = {
    name: "",
    price: "",
    category: "Snacks",
    description: "",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80",
    dietary: [] as string[],
    ingredients: "",
    calories: 350,
    prepTime: "10 mins",
    spiciness: 1,
    allergens: [] as string[],
    tasteProfile: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 }
  };

  const [addForm, setAddForm] = useState(initialForm);

  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/merchant/menu", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await parseMerchantPortalJson<MerchantMenuApiResponse>(response)) ?? { dishes: [] };
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load menu.");
        return payload.dishes ?? [];
      })
      .then((rows) => {
        if (cancelled) return;
        const nextDishes = rows.map(normalizeDish);
        setDishes(nextDishes);
        setCategories(Array.from(new Set(nextDishes.map((dish) => dish.category).filter(Boolean))));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Unable to load menu."))
      .finally(() => {
        if (!cancelled) setIsSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const applyRemoteDishes = (rows: Partial<Dish>[] = []) => {
    const nextDishes = rows.map(normalizeDish);
    setDishes(nextDishes);
    const nextCategories = Array.from(new Set(nextDishes.map((dish) => dish.category).filter(Boolean)));
    setCategories(nextCategories.length > 0 ? nextCategories : ["Menu"]);
  };

  const readMenuResponse = async (response: Response) => {
    const payload = (await parseMerchantPortalJson<MerchantMenuApiResponse>(response)) ?? { dishes: [] };
    if (!response.ok) throw new Error(payload?.error ?? "Unable to sync menu.");
    if (payload?.dishes) {
      applyRemoteDishes(payload.dishes);
    }
    return payload;
  };

  const filtered = dishes.filter((d) => {
    const matchCat = category === "All" || d.category === category;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedDishes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSoldOut = async (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const nextDish = { ...dish, isSoldOut: !dish.isSoldOut };
    setDishes((prev) => prev.map((d) => d.id === id ? nextDish : d));
    try {
      await readMenuResponse(await merchantMutationFetch(`/api/merchant/menu/${id}`, {
        body: JSON.stringify(nextDish),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }));
      showToast(dish.isSoldOut ? `${dish.name} marked as available` : `${dish.name} marked as sold out`);
    } catch (error) {
      setDishes((prev) => prev.map((d) => d.id === id ? dish : d));
      showToast(error instanceof Error ? error.message : "Unable to update dish.");
    }
  };

  const toggleFeatured = async (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const nextDish = { ...dish, isFeatured: !dish.isFeatured };
    setDishes((prev) => prev.map((d) => d.id === id ? nextDish : d));
    try {
      await readMenuResponse(await merchantMutationFetch(`/api/merchant/menu/${id}`, {
        body: JSON.stringify(nextDish),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }));
      showToast(dish.isFeatured ? `${dish.name} removed from featured` : `${dish.name} is now featured`);
    } catch (error) {
      setDishes((prev) => prev.map((d) => d.id === id ? dish : d));
      showToast(error instanceof Error ? error.message : "Unable to update dish.");
    }
  };

  const handleDelete = async (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const previous = dishes;
    setDishes((prev) => prev.filter((d) => d.id !== id));
    setConfirmDelete(null);
    try {
      await readMenuResponse(await merchantMutationFetch(`/api/merchant/menu/${id}`, { method: "DELETE" }));
      showToast(`${dish.name} deleted`);
    } catch (error) {
      setDishes(previous);
      showToast(error instanceof Error ? error.message : "Unable to delete dish.");
    }
  };

  const handleAddDish = async () => {
    if (!addForm.name.trim() || !addForm.price.trim()) return;
    const newDish: Dish = {
      id: `d${Date.now()}`,
      name: addForm.name,
      price: addForm.price.startsWith("S$") ? addForm.price : `S$${addForm.price}`,
      category: addForm.category,
      description: addForm.description,
      isSoldOut: false,
      isFeatured: false,
      imageUrl: addForm.imageUrl,
      dietary: addForm.dietary,
      ingredients: addForm.ingredients ? addForm.ingredients.split(",").map(s => s.trim()).filter(Boolean) : [],
      calories: Number(addForm.calories) || 0,
      prepTime: addForm.prepTime || "10 mins",
      spiciness: addForm.spiciness,
      allergens: addForm.allergens,
      tasteProfile: addForm.tasteProfile
    };
    try {
      await readMenuResponse(await merchantMutationFetch("/api/merchant/menu", {
        body: JSON.stringify(newDish),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }));
      setAddModalOpen(false);
      setAddForm({ ...initialForm, category: categories[0] || "Snacks" });
      showToast(`${newDish.name} added to menu`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to add dish.");
    }
  };

  const handleEditDishSave = async () => {
    if (!editDish || !editDish.name.trim() || !editDish.price.trim()) return;
    const nextDish = {
      ...editDish,
      price: editDish.price.startsWith("S$") ? editDish.price : `S$${editDish.price}`
    };
    try {
      await readMenuResponse(await merchantMutationFetch(`/api/merchant/menu/${editDish.id}`, {
        body: JSON.stringify(nextDish),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }));
      setEditDish(null);
      showToast(`${editDish.name} updated successfully`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update dish.");
    }
  };

  // Category management functions
  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      showToast("Category already exists");
      return;
    }
    setCategories(prev => [...prev, trimmed]);
    setNewCatInput("");
    showToast(`Category "${trimmed}" added`);
  };

  const handleRenameCategory = (oldName: string) => {
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingCat(null);
      return;
    }
    if (categories.includes(trimmed)) {
      showToast("Category name already exists");
      return;
    }
    // Update categories array
    setCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    // Update active category filters
    if (category === oldName) setCategory(trimmed);
    // Update all matching dishes in local state
    setDishes(prev => prev.map(d => d.category === oldName ? { ...d, category: trimmed } : d));
    setRenamingCat(null);
    setRenameInput("");
    showToast(`Renamed "${oldName}" to "${trimmed}"`);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    // Delete or reassign dishes
    if (deleteReassignCat === "delete_all") {
      setDishes(prev => prev.filter(d => d.category !== catToDelete));
      showToast(`Category "${catToDelete}" and all its dishes deleted`);
    } else {
      setDishes(prev => prev.map(d => d.category === catToDelete ? { ...d, category: deleteReassignCat } : d));
      showToast(`Category "${catToDelete}" deleted. Dishes moved to "${deleteReassignCat}"`);
    }
    setCategories(prev => prev.filter(c => c !== catToDelete));
    if (category === catToDelete) setCategory("All");
    setDeletingCat(null);
  };

  const handlePresetPhotoSelect = (url: string) => {
    if (imagePickerTarget === "add") {
      setAddForm(prev => ({ ...prev, imageUrl: url }));
    } else if (editDish) {
      setEditDish(prev => prev ? { ...prev, imageUrl: url } : prev);
    }
    setImagePickerOpen(false);
  };

  const handleCustomPhotoSubmit = () => {
    if (!customImageUrlInput.trim()) return;
    handlePresetPhotoSelect(customImageUrlInput.trim());
    setCustomImageUrlInput("");
  };

  // Dietary and Allergen toggles
  const handleDietaryToggle = (formType: "add" | "edit", tag: string) => {
    if (formType === "add") {
      setAddForm(prev => {
        const active = prev.dietary.includes(tag)
          ? prev.dietary.filter(t => t !== tag)
          : [...prev.dietary, tag];
        return { ...prev, dietary: active };
      });
    } else if (editDish) {
      setEditDish(prev => {
        if (!prev) return prev;
        const active = prev.dietary.includes(tag)
          ? prev.dietary.filter(t => t !== tag)
          : [...prev.dietary, tag];
        return { ...prev, dietary: active };
      });
    }
  };

  const handleAllergenToggle = (formType: "add" | "edit", allergen: string) => {
    if (formType === "add") {
      setAddForm(prev => {
        const active = prev.allergens.includes(allergen)
          ? prev.allergens.filter(a => a !== allergen)
          : [...prev.allergens, allergen];
        return { ...prev, allergens: active };
      });
    } else if (editDish) {
      setEditDish(prev => {
        if (!prev) return prev;
        const active = prev.allergens.includes(allergen)
          ? prev.allergens.filter(a => a !== allergen)
          : [...prev.allergens, allergen];
        return { ...prev, allergens: active };
      });
    }
  };

  const ocrDraftCount = 2;
  const allergenList = ["Gluten", "Peanuts", "Seafood", "Shellfish", "Egg", "Soy", "Sesame", "Dairy", "Fish"];
  const dietaryList = ["Halal", "Vegetarian", "Vegan", "Healthy Choice"];

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Menu</h1>
          <p>
            {isSyncing ? "Syncing menu..." : `${dishes.length} items · ${dishes.filter((d) => !d.isSoldOut).length} available · ${dishes.filter((d) => d.isSoldOut).length} sold out`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button className={styles.actionButtonSecondary} onClick={() => setManageCategoriesOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Settings size={15} /> Manage Sections
          </button>
          <button className={styles.actionButton} onClick={() => {
            setAddForm({ ...initialForm, category: categories[0] || "Rice" });
            setAddModalOpen(true);
          }}>
            <Plus size={15} /> Add Dish
          </button>
        </div>
      </div>

      {/* OCR drafts banner */}
      {ocrDraftCount > 0 && (
        <div className={`${styles.alertBanner} ${styles.alertBannerWarning}`} style={{ marginBottom: "var(--space-6)" }}>
          <div className={styles.alertContent}>
            <Scan size={18} color="var(--color-primary)" />
            <div className={styles.alertText}>
              <h4>{ocrDraftCount} OCR Menu Drafts ready for review</h4>
              <p>Dishes detected from your menu photo upload — review and accept them.</p>
            </div>
          </div>
          <Link href="/merchant/menu/ocr-drafts" className={styles.rowActionPrimary} style={{ padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-xs)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            Review Drafts <X size={12} style={{ transform: "rotate(45deg)" }} />
          </Link>
        </div>
      )}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrapper}>
          <Search size={15} style={{ color: "var(--color-text-muted)", marginRight: "8px" }} />
          <input
            type="search"
            placeholder="Search dishes..."
            className={styles.filterSearchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabNavItem} ${category === "All" ? styles.tabNavItemActive : ""}`}
          onClick={() => setCategory("All")}
        >
          All ({dishes.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={`${styles.tabNavItem} ${category === c ? styles.tabNavItemActive : ""}`}
            onClick={() => setCategory(c)}
          >
            {c} ({dishes.filter((d) => d.category === c).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No dishes found</p>
          <p className={styles.emptyStateDesc}>Try adjusting your search or category filter.</p>
          <button className={styles.actionButton} onClick={() => setAddModalOpen(true)}>
            <Plus size={14} /> Add First Dish
          </button>
        </div>
      ) : (
        <div className={styles.dishGrid}>
          {filtered.map((dish) => {
            const isExpanded = !!expandedDishes[dish.id];
            return (
              <div key={dish.id} className={styles.dishCard} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={dish.imageUrl}
                    alt={dish.name}
                    className={styles.dishCardImage}
                    style={{ opacity: dish.isSoldOut ? 0.5 : 1, height: "160px", width: "100%", objectFit: "cover" }}
                  />
                  {dish.dietary && dish.dietary.length > 0 && (
                    <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {dish.dietary.map(d => (
                        <span key={d} style={{ backgroundColor: "#14B8A6", color: "white", padding: "2px 6px", fontSize: "10px", fontWeight: 700, borderRadius: "var(--radius-sm)" }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.dishCardBody} style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
                      <div className={styles.dishCardName} style={{ margin: 0, fontWeight: 700 }}>{dish.name}</div>
                      <div className={styles.dishCardPrice} style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)", fontWeight: 700 }}>{dish.price}</div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "var(--space-2)", margin: "4px 0 8px 0" }}>
                      <span style={{ fontSize: "var(--font-size-xs)", backgroundColor: "var(--color-bg-soft)", padding: "2px 6px", borderRadius: "var(--radius-sm)", color: "var(--color-text-secondary)" }}>
                        {dish.category}
                      </span>
                      {dish.prepTime && (
                        <span style={{ fontSize: "var(--font-size-xs)", display: "flex", alignItems: "center", gap: "2px", color: "var(--color-text-muted)" }}>
                          <Clock size={11} /> {dish.prepTime}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", lineHeight: 1.4 }}>
                      {dish.description}
                    </p>

                    {/* Expandable Chevron Trigger */}
                    <button
                      onClick={() => toggleExpand(dish.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "var(--color-primary)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginBottom: "var(--space-3)"
                      }}
                    >
                      {isExpanded ? (
                        <>Collapse details <ChevronUp size={14} /></>
                      ) : (
                        <>View taste profile & ingredients <ChevronDown size={14} /></>
                      )}
                    </button>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                        {/* Spiciness & Calories */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)", fontSize: "var(--font-size-xs)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Spiciness:</span>
                            {dish.spiciness === 0 ? (
                              <span style={{ color: "var(--color-text-muted)" }}>None</span>
                            ) : (
                              <span style={{ display: "flex" }}>
                                {Array.from({ length: dish.spiciness }).map((_, idx) => (
                                  <Flame key={idx} size={12} color="#E8531E" style={{ fill: "var(--color-primary)", marginRight: "1px" }} />
                                ))}
                              </span>
                            )}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Energy:</span>{" "}
                            <span style={{ fontFamily: "var(--font-mono)" }}>{dish.calories || 0} kcal</span>
                          </div>
                        </div>

                        {/* Ingredients */}
                        {dish.ingredients && dish.ingredients.length > 0 && (
                          <div style={{ marginBottom: "var(--space-3)" }}>
                            <div style={{ fontWeight: 600, fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginBottom: "4px" }}>Ingredients:</div>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {dish.ingredients.map(ing => (
                                <span key={ing} style={{ fontSize: "10px", backgroundColor: "var(--color-bg-muted)", color: "var(--color-text-primary)", padding: "2px 6px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Allergens warning */}
                        {dish.allergens && dish.allergens.length > 0 && (
                          <div style={{ marginBottom: "var(--space-3)", backgroundColor: "#FEF2F2", padding: "6px var(--space-2)", borderRadius: "var(--radius-sm)", border: "1px solid #FEE2E2", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                            <AlertTriangle size={13} style={{ color: "#EF4444", flexShrink: 0, marginTop: "1px" }} />
                            <div style={{ fontSize: "10px", color: "#991B1B", lineHeight: 1.3 }}>
                              <strong style={{ fontWeight: 700 }}>Allergens:</strong> {dish.allergens.join(", ")}
                            </div>
                          </div>
                        )}

                        {/* Taste Vector Bars */}
                        {dish.tasteProfile && (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>Taste Profile Vector:</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                              {Object.entries(dish.tasteProfile).map(([axis, val]) => (
                                <div key={axis}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", textTransform: "capitalize", color: "var(--color-text-muted)", marginBottom: "1px" }}>
                                    <span>{axis}</span>
                                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{val}/10</span>
                                  </div>
                                  <div style={{ height: "4px", backgroundColor: "var(--color-bg-muted)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${val * 10}%`, backgroundColor: axis === "spicy" ? "#EF4444" : "var(--color-primary)", borderRadius: "var(--radius-full)" }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className={styles.dishCardToggles} style={{ marginTop: "4px", marginBottom: "var(--space-2)" }}>
                      <span className={`${styles.dishTag} ${dish.isSoldOut ? styles.dishTagSoldOut : styles.dishTagAvailable}`}>
                        {dish.isSoldOut ? "Sold Out" : "Available"}
                      </span>
                      {dish.isFeatured && <span className={`${styles.dishTag} ${styles.dishTagFeatured}`}>Featured</span>}
                    </div>
                    
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <button className={styles.rowAction} onClick={() => toggleSoldOut(dish.id)} style={{ flexGrow: 1, fontSize: "var(--font-size-xs)" }}>
                        {dish.isSoldOut ? "Available" : "Sold Out"}
                      </button>
                      <button className={styles.rowAction} onClick={() => toggleFeatured(dish.id)} style={{ flexGrow: 1, fontSize: "var(--font-size-xs)" }}>
                        {dish.isFeatured ? "Unfeature" : "Feature"}
                      </button>
                      <button className={styles.rowAction} onClick={() => setEditDish(dish)} aria-label="Edit dish" style={{ padding: "var(--space-1) var(--space-2)" }}>
                        <Edit2 size={12} />
                      </button>
                      <button className={`${styles.rowAction} ${styles.rowActionDanger}`} onClick={() => setConfirmDelete(dish.id)} aria-label="Delete dish" style={{ padding: "var(--space-1) var(--space-2)" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Management Modal */}
      {manageCategoriesOpen && (
        <div className={styles.modalOverlay} onClick={() => setManageCategoriesOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className={styles.modalHeader}>
              <h3>Manage Menu Sections</h3>
            </div>
            <div className={styles.modalBody}>
              {/* Add category form */}
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                <input
                  className={styles.formInput}
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="New section name (e.g. Desserts)"
                  style={{ margin: 0 }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <button className={styles.actionButton} onClick={handleAddCategory} disabled={!newCatInput.trim()}>
                  <Plus size={14} /> Add
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {categories.map((c) => (
                  <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                    {renamingCat === c ? (
                      <div style={{ display: "flex", gap: "var(--space-2)", width: "100%" }}>
                        <input
                          className={styles.formInput}
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          style={{ margin: 0, padding: "4px 8px" }}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(c)}
                        />
                        <button className={styles.actionButton} onClick={() => handleRenameCategory(c)} style={{ padding: "2px 8px" }}>Save</button>
                        <button className={styles.actionButtonSecondary} onClick={() => setRenamingCat(null)} style={{ padding: "2px 8px" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 700 }}>{c} <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>({dishes.filter(d => d.category === c).length} items)</span></span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button className={styles.rowAction} onClick={() => {
                            setRenamingCat(c);
                            setRenameInput(c);
                          }}>
                            <Edit2 size={12} /> Rename
                          </button>
                          <button
                            className={`${styles.rowAction} ${styles.rowActionDanger}`}
                            disabled={categories.length <= 1}
                            onClick={() => {
                              setDeletingCat(c);
                              const remaining = categories.filter(x => x !== c);
                              setDeleteReassignCat(remaining[0] || "delete_all");
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButton} onClick={() => setManageCategoriesOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {deletingCat && (
        <div className={styles.modalOverlay} onClick={() => setDeletingCat(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <div className={styles.modalHeader}>
              <h3 style={{ color: "var(--color-error)" }}>Delete Category &quot;{deletingCat}&quot;?</h3>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
                This section will be permanently removed. What should we do with the **{dishes.filter(d => d.category === deletingCat).length}** dishes in this category?
              </p>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Reassignment Option</label>
                <select
                  className={styles.formSelect}
                  value={deleteReassignCat}
                  onChange={(e) => setDeleteReassignCat(e.target.value)}
                >
                  <option value="delete_all">❌ Delete all dishes in this category</option>
                  {categories.filter(c => c !== deletingCat).map(c => (
                    <option key={c} value={c}>➡️ Move dishes to &quot;{c}&quot;</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setDeletingCat(null)}>Cancel</button>
              <button className={styles.actionButtonDanger} onClick={() => handleDeleteCategory(deletingCat)}>
                Confirm & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Image Gallery Picker Overlay */}
      {imagePickerOpen && (
        <div className={styles.modalOverlay} onClick={() => setImagePickerOpen(false)} style={{ zIndex: 1100 }}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className={styles.modalHeader}>
              <h3>Select Premium Hawker Dish Photo</h3>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                Choose a pre-seeded high-fidelity photo from our Singapore culinary library.
              </p>

              {/* Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", maxHeight: "300px", overflowY: "auto", padding: "2px", marginBottom: "var(--space-4)" }}>
                {PRESET_PHOTOS.map((ph, idx) => (
                  <div
                    key={idx}
                    onClick={() => handlePresetPhotoSelect(ph.url)}
                    style={{
                      position: "relative",
                      height: "100px",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "2px solid var(--color-border)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >
                    <img src={ph.url} alt={ph.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 6px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "8px", fontWeight: 700, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {ph.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom URL */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Or Paste Custom Unsplash Image URL</label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <input
                    className={styles.formInput}
                    value={customImageUrlInput}
                    onChange={(e) => setCustomImageUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    style={{ margin: 0 }}
                  />
                  <button className={styles.actionButton} onClick={handleCustomPhotoSubmit} disabled={!customImageUrlInput.trim()}>
                    Use URL
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setImagePickerOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Dish modal */}
      {addModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className={styles.modalHeader}>
              <h3>Add New Dish</h3>
            </div>
            <div className={styles.modalBody}>
              {/* Row: Name */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Dish Name *</label>
                <input className={styles.formInput} value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Seafood Laksa" />
              </div>

              {/* Grid: Price, Category */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Price (SGD) *</label>
                  <input className={styles.formInput} value={addForm.price} onChange={(e) => setAddForm((p) => ({ ...p, price: e.target.value }))} placeholder="5.50" />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Category</label>
                  <select className={styles.formSelect} value={addForm.category} onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Description */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Description</label>
                <textarea className={styles.formTextarea} value={addForm.description} onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe this dish, its flavors, key features..." rows={2} />
              </div>

              {/* Custom Image Picker Block */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Food Image</label>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <img src={addForm.imageUrl} alt="Preview" style={{ width: "64px", height: "64px", borderRadius: "var(--radius-md)", objectFit: "cover", border: "1px solid var(--color-border)" }} />
                  <button
                    type="button"
                    className={styles.actionButtonSecondary}
                    onClick={() => {
                      setImagePickerTarget("add");
                      setImagePickerOpen(true);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <ImageIcon size={14} /> Choose Hawker Photo
                  </button>
                </div>
              </div>

              {/* Grid: Calories, Prep Time, Spiciness */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Calories (kcal)</label>
                  <input type="number" className={styles.formInput} value={addForm.calories} onChange={(e) => setAddForm((p) => ({ ...p, calories: Number(e.target.value) || 0 }))} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Prep Time</label>
                  <input className={styles.formInput} value={addForm.prepTime} onChange={(e) => setAddForm((p) => ({ ...p, prepTime: e.target.value }))} placeholder="10 mins" />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Spiciness Scale</label>
                  <select className={styles.formSelect} value={addForm.spiciness} onChange={(e) => setAddForm((p) => ({ ...p, spiciness: Number(e.target.value) }))}>
                    <option value={0}>No Spice</option>
                    <option value={1}>Mild (Level 1)</option>
                    <option value={2}>Medium (Level 2)</option>
                    <option value={3}>Hot (Level 3)</option>
                    <option value={4}>Extra Hot (Level 4)</option>
                  </select>
                </div>
              </div>

              {/* Row: Ingredients Tagging */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Ingredients (comma separated)</label>
                <input className={styles.formInput} value={addForm.ingredients} onChange={(e) => setAddForm((p) => ({ ...p, ingredients: e.target.value }))} placeholder="Fresh prawns, Rice vermicelli, Coconut milk, Bean sprouts" />
              </div>

              {/* Multi-Check: Dietary Labels */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Dietary Certifications</label>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  {dietaryList.map(tag => {
                    const isChecked = addForm.dietary.includes(tag);
                    return (
                      <label key={tag} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer", backgroundColor: isChecked ? "var(--color-bg-soft)" : "var(--color-bg-muted)", padding: "4px 10px", borderRadius: "var(--radius-pill)", border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--color-border)"}` }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleDietaryToggle("add", tag)} style={{ display: "none" }} />
                        <span style={{ color: isChecked ? "var(--color-primary)" : "var(--color-text-secondary)", fontWeight: 700 }}>{tag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Check: Allergens Warnings */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Allergens Warning Labels</label>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {allergenList.map(allergen => {
                    const isChecked = addForm.allergens.includes(allergen);
                    return (
                      <label key={allergen} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer", backgroundColor: isChecked ? "#FEF2F2" : "var(--color-bg-muted)", padding: "4px 10px", borderRadius: "var(--radius-pill)", border: `1px solid ${isChecked ? "#EF4444" : "var(--color-border)"}` }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleAllergenToggle("add", allergen)} style={{ display: "none" }} />
                        <span style={{ color: isChecked ? "#EF4444" : "var(--color-text-secondary)", fontWeight: 700 }}>{allergen}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 6-Axis Taste Profiles sliders */}
              <div className={styles.formRow} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel} style={{ marginBottom: "var(--space-3)", fontWeight: 700 }}>6-Axis Taste Profiles (0 to 10)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3) var(--space-4)" }}>
                  {Object.entries(addForm.tasteProfile).map(([axis, val]) => (
                    <div key={axis}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", textTransform: "capitalize", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                        <span>{axis}</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{val} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={val}
                        onChange={(e) => {
                          const nVal = Number(e.target.value) || 0;
                          setAddForm(p => ({
                            ...p,
                            tasteProfile: { ...p.tasteProfile, [axis]: nVal }
                          }));
                        }}
                        style={{ width: "100%", accentColor: "var(--color-primary)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setAddModalOpen(false)}>Cancel</button>
              <button className={styles.actionButton} onClick={handleAddDish} disabled={!addForm.name.trim() || !addForm.price.trim()}>
                <Plus size={14} /> Add Dish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editDish && (
        <div className={styles.modalOverlay} onClick={() => setEditDish(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className={styles.modalHeader}>
              <h3>Edit — {editDish.name}</h3>
            </div>
            <div className={styles.modalBody}>
              {/* Row: Name */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Dish Name *</label>
                <input className={styles.formInput} value={editDish.name} onChange={(e) => setEditDish((p) => p ? { ...p, name: e.target.value } : p)} />
              </div>

              {/* Grid: Price, Category */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Price (SGD) *</label>
                  <input className={styles.formInput} value={editDish.price} onChange={(e) => setEditDish((p) => p ? { ...p, price: e.target.value } : p)} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Category</label>
                  <select className={styles.formSelect} value={editDish.category} onChange={(e) => setEditDish((p) => p ? { ...p, category: e.target.value } : p)}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Description */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Description</label>
                <textarea className={styles.formTextarea} value={editDish.description} onChange={(e) => setEditDish((p) => p ? { ...p, description: e.target.value } : p)} rows={2} />
              </div>

              {/* Custom Image Picker Block */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Food Image</label>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                  <img src={editDish.imageUrl} alt="Preview" style={{ width: "64px", height: "64px", borderRadius: "var(--radius-md)", objectFit: "cover", border: "1px solid var(--color-border)" }} />
                  <button
                    type="button"
                    className={styles.actionButtonSecondary}
                    onClick={() => {
                      setImagePickerTarget("edit");
                      setImagePickerOpen(true);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <ImageIcon size={14} /> Choose Hawker Photo
                  </button>
                </div>
              </div>

              {/* Grid: Calories, Prep Time, Spiciness */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Calories (kcal)</label>
                  <input type="number" className={styles.formInput} value={editDish.calories || 0} onChange={(e) => setEditDish((p) => p ? { ...p, calories: Number(e.target.value) || 0 } : p)} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Prep Time</label>
                  <input className={styles.formInput} value={editDish.prepTime || ""} onChange={(e) => setEditDish((p) => p ? { ...p, prepTime: e.target.value } : p)} />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Spiciness Scale</label>
                  <select className={styles.formSelect} value={editDish.spiciness || 0} onChange={(e) => setEditDish((p) => p ? { ...p, spiciness: Number(e.target.value) } : p)}>
                    <option value={0}>No Spice</option>
                    <option value={1}>Mild (Level 1)</option>
                    <option value={2}>Medium (Level 2)</option>
                    <option value={3}>Hot (Level 3)</option>
                    <option value={4}>Extra Hot (Level 4)</option>
                  </select>
                </div>
              </div>

              {/* Row: Ingredients Tagging */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Ingredients (comma separated)</label>
                <input className={styles.formInput} value={editDish.ingredients ? editDish.ingredients.join(", ") : ""} onChange={(e) => setEditDish((p) => p ? { ...p, ingredients: e.target.value.split(",").map(x => x.trim()).filter(Boolean) } : p)} />
              </div>

              {/* Multi-Check: Dietary Labels */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Dietary Certifications</label>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  {dietaryList.map(tag => {
                    const isChecked = editDish.dietary ? editDish.dietary.includes(tag) : false;
                    return (
                      <label key={tag} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer", backgroundColor: isChecked ? "var(--color-bg-soft)" : "var(--color-bg-muted)", padding: "4px 10px", borderRadius: "var(--radius-pill)", border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--color-border)"}` }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleDietaryToggle("edit", tag)} style={{ display: "none" }} />
                        <span style={{ color: isChecked ? "var(--color-primary)" : "var(--color-text-secondary)", fontWeight: 700 }}>{tag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Check: Allergens Warnings */}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Allergens Warning Labels</label>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {allergenList.map(allergen => {
                    const isChecked = editDish.allergens ? editDish.allergens.includes(allergen) : false;
                    return (
                      <label key={allergen} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)", cursor: "pointer", backgroundColor: isChecked ? "#FEF2F2" : "var(--color-bg-muted)", padding: "4px 10px", borderRadius: "var(--radius-pill)", border: `1px solid ${isChecked ? "#EF4444" : "var(--color-border)"}` }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleAllergenToggle("edit", allergen)} style={{ display: "none" }} />
                        <span style={{ color: isChecked ? "#EF4444" : "var(--color-text-secondary)", fontWeight: 700 }}>{allergen}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 6-Axis Taste Profiles sliders */}
              {editDish.tasteProfile && (
                <div className={styles.formRow} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-3)" }}>
                  <label className={styles.formLabel} style={{ marginBottom: "var(--space-3)", fontWeight: 700 }}>6-Axis Taste Profiles (0 to 10)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3) var(--space-4)" }}>
                    {Object.entries(editDish.tasteProfile).map(([axis, val]) => (
                      <div key={axis}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", textTransform: "capitalize", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                          <span>{axis}</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>{val} / 10</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={val}
                          onChange={(e) => {
                            const nVal = Number(e.target.value) || 0;
                            setEditDish(p => {
                              if (!p) return p;
                              return {
                                ...p,
                                tasteProfile: { ...p.tasteProfile, [axis]: nVal }
                              };
                            });
                          }}
                          style={{ width: "100%", accentColor: "var(--color-primary)" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setEditDish(null)}>Cancel</button>
              <button className={styles.actionButton} onClick={handleEditDishSave}>
                <CheckCircle size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}><h3>Delete Dish?</h3></div>
            <div className={styles.modalBody}>This will remove the dish from your menu. This cannot be undone.</div>
            <div className={styles.modalFooter}>
              <button className={styles.actionButtonSecondary} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className={styles.actionButtonDanger} onClick={() => handleDelete(confirmDelete)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
