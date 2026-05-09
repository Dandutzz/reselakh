"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Spinner from "@/components/loading/Spinner";
import ProductForm, {
  type CashbackType,
  type CategoryOption,
  type ExistingVariant,
  type ProductFormInitial,
} from "../../_components/ProductForm";

interface VariationLite {
  id: string;
  name: string;
  code: string;
  price: number;
}

interface ProductLite {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  isActive: boolean;
  config: string | null;
  variations: VariationLite[];
}

interface ProductConfig {
  terms?: string;
  shortDescription?: string;
  cashbackType?: CashbackType;
  cashbackValue?: number;
  profit?: number;
  modeBulking?: number;
  stockFormat?: string;
  defaultAutoDelivery?: boolean;
}

function parseConfig(raw: string | null): ProductConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ProductConfig;
  } catch {
    return {};
  }
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ProductFormInitial | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = params?.id;
    if (!id) return;

    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/user/products"),
          fetch("/api/user/categories"),
        ]);
        const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
        if (cancelled) return;
        const products: ProductLite[] = pData.products || [];
        const product = products.find((p) => p.id === id);
        if (!product) {
          setError("Produk tidak ditemukan");
          return;
        }
        const cats: CategoryOption[] = cData.categories || [];
        setCategories(cats);

        const cfg = parseConfig(product.config);
        const variantPreviews: ExistingVariant[] = await Promise.all(
          product.variations.map(async (v) => {
            try {
              const sRes = await fetch(
                `/api/user/stocks?variationId=${v.id}&sold=false`,
              );
              const sData = await sRes.json();
              const list: string[] = (sData.stocks || []).map(
                (s: { data: string }) => s.data,
              );
              return {
                id: v.id,
                name: v.name,
                code: v.code,
                price: v.price,
                unsoldStocks: list.slice(0, 50),
              };
            } catch {
              return {
                id: v.id,
                name: v.name,
                code: v.code,
                price: v.price,
                unsoldStocks: [],
              };
            }
          }),
        );

        if (cancelled) return;
        setInitial({
          productId: product.id,
          categoryId: product.categoryId,
          code: product.code,
          name: product.name,
          shortDescription: cfg.shortDescription ?? "",
          description: product.description ?? "",
          image: product.image ?? "",
          price: product.price,
          isActive: product.isActive,
          terms: cfg.terms ?? "",
          defaultAutoDelivery: cfg.defaultAutoDelivery ?? true,
          cashbackType: cfg.cashbackType ?? "nominal",
          cashbackValue: cfg.cashbackValue ?? 0,
          profit: cfg.profit ?? 0,
          modeBulking: cfg.modeBulking ?? 0,
          stockFormat: cfg.stockFormat ?? "email|password",
          variants: variantPreviews,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Gagal memuat produk");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => router.push("/panel/products")}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm"
        >
          Kembali ke daftar produk
        </button>
      </div>
    );
  }

  if (!initial) return <Spinner />;

  return <ProductForm mode="edit" initial={initial} categories={categories} />;
}
