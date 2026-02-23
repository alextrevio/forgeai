import { useState, useMemo, useCallback } from "react";
import { Plus, Search, Trash2, CheckCircle, Inbox } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { useAppStore } from "../store/app-store";
import type { Status } from "../types";

const STATUS_FILTERS: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function Items() {
  const { items, searchQuery, filterStatus, setSearchQuery, setFilterStatus, addItem, deleteItem, toggleStatus } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, filterStatus]);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    addItem(newTitle.trim(), newDescription.trim(), "medium");
    setNewTitle("");
    setNewDescription("");
    setShowCreateModal(false);
  }, [newTitle, newDescription, addItem]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your items</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          iconLeft={<Search className="w-4 h-4" />}
          className="sm:w-72"
        />
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === filter.value
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No items found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {searchQuery ? "Try adjusting your search." : "Create your first item to get started."}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowCreateModal(true)} className="mt-4" variant="outline">
              <Plus className="w-4 h-4" /> Create Item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleStatus(item.id)}
                    className={`p-1 rounded-full transition-colors ${
                      item.status === "completed"
                        ? "text-green-600"
                        : "text-gray-300 hover:text-green-500"
                    }`}
                    aria-label={`Toggle ${item.title}`}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${
                      item.status === "completed"
                        ? "line-through text-gray-400 dark:text-gray-500"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "active" ? "success" : item.status === "completed" ? "info" : "default"}>
                    {item.status}
                  </Badge>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Item" description="Add a new item to your list.">
        <div className="space-y-4">
          <Input label="Title" placeholder="Enter item title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Input label="Description" placeholder="Enter description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
