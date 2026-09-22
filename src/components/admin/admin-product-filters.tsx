"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.products;

type CategoryFilterOption = {
  id: string;
  name: string;
};

type AdminProductFiltersProps = {
  categories: CategoryFilterOption[];
  initialQ: string;
  initialCategoryId: string;
  initialStatus: string;
};

export function AdminProductFilters({
  categories,
  initialQ,
  initialCategoryId,
  initialStatus,
}: AdminProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);

  function applyFilters(next: {
    q?: string;
    categoria?: string;
    status?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    const nextQ = next.q ?? q;
    const nextCategory = next.categoria ?? initialCategoryId;
    const nextStatus = next.status ?? initialStatus;

    if (nextQ.trim()) {
      params.set("q", nextQ.trim());
    } else {
      params.delete("q");
    }

    if (nextCategory) {
      params.set("categoria", nextCategory);
    } else {
      params.delete("categoria");
    }

    if (nextStatus) {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }

    const query = params.toString();
    router.push(query ? `/admin/produtos?${query}` : "/admin/produtos");
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters({ q });
      }}
    >
      <div className="min-w-[12rem] flex-1 space-y-2">
        <Label htmlFor="admin-product-q">{copy.filterSearch}</Label>
        <Input
          id="admin-product-q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="min-h-11"
        />
      </div>
      <div className="min-w-[12rem] space-y-2">
        <Label htmlFor="admin-product-categoria">{copy.filterCategory}</Label>
        <Select
          value={initialCategoryId || "all"}
          onValueChange={(value) =>
            applyFilters({ categoria: value === "all" ? "" : value })
          }
        >
          <SelectTrigger id="admin-product-categoria" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.filterCategoryAll}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[12rem] space-y-2">
        <Label htmlFor="admin-product-status">{copy.filterStatus}</Label>
        <Select
          value={initialStatus || "all"}
          onValueChange={(value) =>
            applyFilters({ status: value === "all" ? "" : value })
          }
        >
          <SelectTrigger id="admin-product-status" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.filterStatusAll}</SelectItem>
            <SelectItem value="draft">{copy.statusDraft}</SelectItem>
            <SelectItem value="published">{copy.statusPublished}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="min-h-11">
        {copy.filterSearchSubmit}
      </Button>
    </form>
  );
}
