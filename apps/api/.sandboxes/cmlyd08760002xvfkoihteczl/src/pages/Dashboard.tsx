import { useMemo } from "react";
import { BarChart3, ListTodo, CheckCircle, Archive } from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { useAppStore } from "../store/app-store";
import type { Stats } from "../types";

export function Dashboard() {
  const items = useAppStore((s) => s.items);

  const stats: Stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.status === "active").length,
      completed: items.filter((i) => i.status === "completed").length,
      archived: items.filter((i) => i.status === "archived").length,
    }),
    [items]
  );

  const statCards = [
    { label: "Total Items", value: stats.total, icon: ListTodo, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Active", value: stats.active, icon: BarChart3, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "Archived", value: stats.archived, icon: Archive, color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-800" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your items and activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No items yet. Create your first item to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : item.status === "completed"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
