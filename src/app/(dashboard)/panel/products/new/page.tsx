"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/loading/Spinner";
import ProductForm, {
  type CategoryOption,
  type ProductFormInitial,
} from "../_components/ProductForm";

const EMPTY: ProductFormInitial = {
  productId: null,
  categoryId: "",
  code: "",
  name: "",
  shortDescription: "",
  description: "",
  image: "",
  price: 0,
  isActive: true,
  terms: "",
  defaultAutoDelivery: true,
  cashbackType: "nominal",
  cashbackValue: 0,
  profit: 0,
  modeBulking: 0,
  stockFormat: "email|password",
  variants: [],
};

export default function NewProductPage() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/categories")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCategories(d.categories || []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner />;
  return <ProductForm mode="create" initial={EMPTY} categories={categories} />;
}
