"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  Calendar,
  User,
  Barcode,
  Weight,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";
import { MASTER_ENDPOINTS, createRequestOptions } from "@/lib/api-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ManualCutRoll {
  id: string;
  frontend_id: string;
  barcode_id: string;
  client_id: string;
  client_name: string;
  paper_id: string;
  paper_spec: string;
  reel_number: string;
  width_inches: number;
  weight_kg: number;
  status: string;
  location: string;
  created_at: string;
  created_by: string;
}

export default function ManualCutRollsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [manualRolls, setManualRolls] = useState<ManualCutRoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadManualRolls();
  }, []);

  const loadManualRolls = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        MASTER_ENDPOINTS.MANUAL_CUT_ROLLS,
        createRequestOptions("GET")
      );

      if (!response.ok) {
        throw new Error("Failed to load manual cut rolls");
      }

      const data = await response.json();
      setManualRolls(data.manual_cut_rolls || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load manual cut rolls";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "available":
        return "bg-green-500";
      case "dispatched":
        return "bg-blue-500";
      case "damaged":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const filteredRolls = manualRolls.filter((roll) => {
    const matchesSearch =
      roll.frontend_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.barcode_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.reel_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || roll.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 m-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Manual Cut Rolls
          </h1>
          <p className="text-gray-600 mt-2">
            View and manage manually registered cut rolls
          </p>
        </div>
        <Button onClick={() => router.push("/masters/cut-rolls/manual")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Manual Roll
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manual Cut Rolls List</CardTitle>
          <CardDescription>
            Total: {filteredRolls.length} roll(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ID, barcode, client, or reel number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "available" ? "default" : "outline"}
                onClick={() => setStatusFilter("available")}
              >
                Available
              </Button>
              <Button
                variant={statusFilter === "dispatched" ? "default" : "outline"}
                onClick={() => setStatusFilter("dispatched")}
              >
                Dispatched
              </Button>
            </div>
          </div>

          {filteredRolls.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No manual cut rolls found</p>
              <Button
                onClick={() => router.push("/masters/cut-rolls/manual")}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Manual Roll
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reel No.</TableHead>
                    <TableHead>Barcode ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Paper Spec</TableHead>
                    <TableHead>Width (in)</TableHead>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRolls.map((roll) => (
                    <TableRow key={roll.id}>
                      <TableCell className="font-mono">
                        {roll.reel_number}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Barcode className="h-4 w-4 text-gray-400" />
                          <span className="font-mono">{roll.barcode_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>{roll.client_name}</TableCell>
                      <TableCell className="text-sm">
                        {roll.paper_spec}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Ruler className="h-4 w-4 text-gray-400" />
                          {roll.width_inches}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Weight className="h-4 w-4 text-gray-400" />
                          {roll.weight_kg}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(roll.status)}>
                          {roll.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-gray-400" />
                          {roll.created_by}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {new Date(roll.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
