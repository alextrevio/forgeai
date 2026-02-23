export type Status = "active" | "completed" | "archived";
export type Priority = "low" | "medium" | "high";

export interface Item {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stats {
  total: number;
  active: number;
  completed: number;
  archived: number;
}
