"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Factory, Save, Loader2, PlusCircle, Edit3 } from "lucide-react";
import { PRODUCTION_DATA_ENDPOINTS } from "@/lib/api-config";

type Mode = "create" | "edit";

export default function ProductionDataPage() {
  const [mode, setMode] = useState<Mode>("create");
  const [formData, setFormData] = useState({
    date: "",
    productionDay: "",
    productionNight: "",
    electricity: "",
    coal: "",
    bhushi: "",
    dispatchTon: "",
    poTon: "",
    waste: "",
    starch: "",
    guarGum: "",
    pac: "",
    rct: "",
    sSeizing: "",
    dFormer: "",
    sodiumSilicate: "",
    enzyme: "",
    dsr: "",
    retAid: "",
    colourDye: "",
    poParty: "",
    wastageParty: "",
    dispatchParty: "",
    isShutdown: "No",
    shutdownHours: "",
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dateHasData, setDateHasData] = useState(false);

  // Check if date has existing data (for create mode validation)
  const checkDateHasData = async (date: string) => {
    try {
      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_BY_DATE(date),
        {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }
      );
      return response.status !== 404;
    } catch {
      return false;
    }
  };

  // Handle date change in create mode
  useEffect(() => {
    if (mode === "create" && formData.date) {
      const checkDate = async () => {
        const hasData = await checkDateHasData(formData.date);
        setDateHasData(hasData);
        if (hasData) {
          toast.error("Data already exists for this date. Use Edit mode to modify.");
        }
      };
      checkDate();
    }
  }, [formData.date, mode]);

  // Fetch data for edit mode
  const fetchProductionData = async (date: string) => {
    if (!date) {
      toast.error("Please select a date to search");
      return;
    }

    try {
      setLoading(true);
      setDataLoaded(false);

      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_BY_DATE(date),
        {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }
      );

      if (response.status === 404) {
        toast.error("No production data found for this date");
        resetFormFields();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch production data');
      }

      const data = await response.json();

      setFormData({
        date: date,
        productionDay: data.production_day?.toString() || "",
        productionNight: data.production_night?.toString() || "",
        electricity: data.electricity?.toString() || "",
        coal: data.coal?.toString() || "",
        bhushi: data.bhushi?.toString() || "",
        dispatchTon: data.dispatch_ton?.toString() || "",
        poTon: data.po_ton?.toString() || "",
        waste: data.waste?.toString() || "",
        starch: data.starch?.toString() || "",
        guarGum: data.guar_gum?.toString() || "",
        pac: data.pac?.toString() || "",
        rct: data.rct?.toString() || "",
        sSeizing: data.s_seizing?.toString() || "",
        dFormer: data.d_former?.toString() || "",
        sodiumSilicate: data.sodium_silicate?.toString() || "",
        enzyme: data.enzyme?.toString() || "",
        dsr: data.dsr?.toString() || "",
        retAid: data.ret_aid?.toString() || "",
        colourDye: data.colour_dye?.toString() || "",
        poParty: data.po_party?.toString() || "",
        wastageParty: data.wastage_party?.toString() || "",
        dispatchParty: data.dispatch_party?.toString() || "",
        isShutdown: data.is_shutdown?.toString() || "No",
        shutdownHours: data.shutdown_hours?.toString() || "",
      });

      setDataLoaded(true);
      toast.success("Production data loaded for editing");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch production data';
      toast.error(errorMessage);
      console.error('Error fetching production data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetFormFields = () => {
    setFormData(prev => ({
      date: prev.date,
      productionDay: "",
      productionNight: "",
      electricity: "",
      coal: "",
      bhushi: "",
      dispatchTon: "",
      poTon: "",
      waste: "",
      starch: "",
      guarGum: "",
      pac: "",
      rct: "",
      sSeizing: "",
      dFormer: "",
      sodiumSilicate: "",
      enzyme: "",
      dsr: "",
      retAid: "",
      colourDye: "",
      poParty: "",
      wastageParty: "",
      dispatchParty: "",
      isShutdown: "No",
      shutdownHours: "",
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      date: value
    }));
    // Reset loaded state when date changes in edit mode
    if (mode === "edit") {
      setDataLoaded(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setDataLoaded(false);
    setDateHasData(false);
    resetFormFields();
    setFormData(prev => ({
      ...prev,
      date: ""
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate in create mode
    if (mode === "create" && dateHasData) {
      toast.error("Data already exists for this date. Use Edit mode to modify.");
      return;
    }

    // Validate in edit mode
    if (mode === "edit" && !dataLoaded) {
      toast.error("Please search and load data first before updating");
      return;
    }

    try {
      setSaving(true);

      const isShutdownDay = formData.isShutdown === "Yes";

      const apiData = {
        date: new Date(formData.date).toISOString(),
        production_day: isShutdownDay ? "0" : (formData.productionDay || "0"),
        production_night: isShutdownDay ? "0" : (formData.productionNight || "0"),
        electricity: formData.electricity || "0",
        coal: formData.coal || "0",
        bhushi: formData.bhushi || "0",
        dispatch_ton: formData.dispatchTon || "0",
        po_ton: formData.poTon || "0",
        waste: formData.waste || "0",
        starch: formData.starch || "0",
        guar_gum: formData.guarGum || "0",
        pac: formData.pac || "0",
        rct: formData.rct || "0",
        s_seizing: formData.sSeizing || "0",
        d_former: formData.dFormer || "0",
        sodium_silicate: formData.sodiumSilicate || "0",
        enzyme: formData.enzyme || "0",
        dsr: formData.dsr || "0",
        ret_aid: formData.retAid || "0",
        colour_dye: formData.colourDye || "0",
        po_party: formData.poParty || "0",
        wastage_party: formData.wastageParty || "0",
        dispatch_party: formData.dispatchParty || "0",
        is_shutdown: formData.isShutdown || null,
        shutdown_hours: formData.shutdownHours || null,
      };

      const response = await fetch(PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        throw new Error('Failed to save production data');
      }

      toast.success(mode === "create" ? "Production data created successfully!" : "Production data updated successfully!");

      if (mode === "create") {
        handleReset();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save production data';
      toast.error(errorMessage);
      console.error('Error saving production data:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      date: "",
      productionDay: "",
      productionNight: "",
      electricity: "",
      coal: "",
      bhushi: "",
      dispatchTon: "",
      poTon: "",
      waste: "",
      starch: "",
      guarGum: "",
      pac: "",
      rct: "",
      sSeizing: "",
      dFormer: "",
      sodiumSilicate: "",
      enzyme: "",
      dsr: "",
      retAid: "",
      colourDye: "",
      poParty: "",
      wastageParty: "",
      dispatchParty: "",
      isShutdown: "No",
      shutdownHours: "",
    });
    setDataLoaded(false);
    setDateHasData(false);
    toast.info("Form reset");
  };

  // Check if fields should be disabled
  const isShutdownMode = formData.isShutdown === "Yes";
  const isFormDisabled = saving || loading;
  const isProductionFieldDisabled = isFormDisabled || isShutdownMode;
  const isOtherFieldDisabled = isFormDisabled;

  // In edit mode, also check if data is loaded
  const canSubmit = mode === "create"
    ? !dateHasData && !isFormDisabled && formData.date !== ""
    : dataLoaded && !isFormDisabled && formData.date !== "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="w-8 h-8 text-primary" />
              Production Data
            </h1>
            <p className="text-muted-foreground">
              {mode === "create" ? "Create new production data entry" : "Edit existing production data"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === "create" ? "default" : "outline"}
              size="lg"
              onClick={() => handleModeChange("create")}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Create
            </Button>
            <Button
              variant={mode === "edit" ? "default" : "outline"}
              size="lg"
              onClick={() => handleModeChange("edit")}
              className="flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>
                {mode === "create" ? "New Production Data Entry" : "Edit Production Data"}
              </CardTitle>
            </div>
            {/* Action Buttons in Header */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleReset}
                disabled={isFormDisabled}
              >
                Reset
              </Button>
              <Button
                type="submit"
                form="production-data-form"
                size="lg"
                className="flex items-center gap-2"
                disabled={!canSubmit}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === "create" ? "Saving..." : "Updating..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                        {mode === "create" ? "Save" : "Update"}
                      </>
                    )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Edit Mode: Search Section */}
            {mode === "edit" && (
              <div className="flex gap-4 items-end mb-6 pb-6 border-b">
                <div className="grid gap-2 flex-1 max-w-xs">
                  <Input
                    id="searchDate"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button
                  onClick={() => fetchProductionData(formData.date)}
                  disabled={loading || !formData.date}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    "Load Data"
                  )}
                </Button>
              </div>
            )}

            {/* Show form in create mode always, in edit mode only after data is loaded */}
            {(mode === "create" || (mode === "edit" && dataLoaded)) && (
              <form id="production-data-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Date validation error for create mode */}
                {mode === "create" && dateHasData && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    Data already exists for this date. Please use Edit mode to modify existing data.
                  </div>
                )}

                {/* All Fields in 4-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date */}
                  <div className="grid gap-2">
                    <Label htmlFor="date" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleDateChange(e.target.value)}
                      required
                      disabled={mode === "edit" || saving}
                      className={mode === "edit" ? "bg-muted" : ""}
                    />
                  </div>

                  {/* Is Shutdown */}
                  <div className="grid gap-2">
                    <Label htmlFor="isShutdown">Is Shutdown</Label>
                    <select
                      id="isShutdown"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.isShutdown}
                      onChange={(e) => handleInputChange('isShutdown', e.target.value)}
                      disabled={isFormDisabled}
                    >
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="productionDay">Production Day</Label>
                    <Input
                      id="productionDay"
                      type="text"
                      value={formData.productionDay}
                      onChange={(e) => handleInputChange('productionDay', e.target.value)}
                      disabled={isProductionFieldDisabled}
                      className={isShutdownMode ? "bg-muted" : ""}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="productionNight">Production Night</Label>
                    <Input
                      id="productionNight"
                      type="text"
                      value={formData.productionNight}
                      onChange={(e) => handleInputChange('productionNight', e.target.value)}
                      disabled={isProductionFieldDisabled}
                      className={isShutdownMode ? "bg-muted" : ""}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="electricity">Electricity</Label>
                    <Input
                      id="electricity"
                      type="text"
                      value={formData.electricity}
                      onChange={(e) => handleInputChange('electricity', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="coal">Coal</Label>
                    <Input
                      id="coal"
                      type="text"
                      value={formData.coal}
                      onChange={(e) => handleInputChange('coal', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bhushi">Bhushi</Label>
                    <Input
                      id="bhushi"
                      type="text"
                      value={formData.bhushi}
                      onChange={(e) => handleInputChange('bhushi', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dispatchTon">Dispatch (Ton)</Label>
                    <Input
                      id="dispatchTon"
                      type="text"
                      value={formData.dispatchTon}
                      onChange={(e) => handleInputChange('dispatchTon', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dispatchParty">Dispatch Party</Label>
                    <Input
                      id="dispatchParty"
                      type="text"
                      value={formData.dispatchParty}
                      onChange={(e) => handleInputChange('dispatchParty', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="poTon">PO (Ton)</Label>
                    <Input
                      id="poTon"
                      type="text"
                      value={formData.poTon}
                      onChange={(e) => handleInputChange('poTon', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="poParty">PO Party</Label>
                    <Input
                      id="poParty"
                      type="text"
                      value={formData.poParty}
                      onChange={(e) => handleInputChange('poParty', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="waste">Waste</Label>
                    <Input
                      id="waste"
                      type="text"
                      value={formData.waste}
                      onChange={(e) => handleInputChange('waste', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="wastageParty">Wastage Party</Label>
                    <Input
                      id="wastageParty"
                      type="text"
                      value={formData.wastageParty}
                      onChange={(e) => handleInputChange('wastageParty', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="starch">Starch</Label>
                    <Input
                      id="starch"
                      type="text"
                      value={formData.starch}
                      onChange={(e) => handleInputChange('starch', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guarGum">Guar Gum</Label>
                    <Input
                      id="guarGum"
                      type="text"
                      value={formData.guarGum}
                      onChange={(e) => handleInputChange('guarGum', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pac">PAC</Label>
                    <Input
                      id="pac"
                      type="text"
                      value={formData.pac}
                      onChange={(e) => handleInputChange('pac', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="rct">RCT</Label>
                    <Input
                      id="rct"
                      type="text"
                      value={formData.rct}
                      onChange={(e) => handleInputChange('rct', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sSeizing">S.Seizing</Label>
                    <Input
                      id="sSeizing"
                      type="text"
                      value={formData.sSeizing}
                      onChange={(e) => handleInputChange('sSeizing', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dFormer">D.Former</Label>
                    <Input
                      id="dFormer"
                      type="text"
                      value={formData.dFormer}
                      onChange={(e) => handleInputChange('dFormer', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sodiumSilicate">Sodium Silicate</Label>
                    <Input
                      id="sodiumSilicate"
                      type="text"
                      value={formData.sodiumSilicate}
                      onChange={(e) => handleInputChange('sodiumSilicate', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="enzyme">Enzyme</Label>
                    <Input
                      id="enzyme"
                      type="text"
                      value={formData.enzyme}
                      onChange={(e) => handleInputChange('enzyme', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dsr">D.S.R.</Label>
                    <Input
                      id="dsr"
                      type="text"
                      value={formData.dsr}
                      onChange={(e) => handleInputChange('dsr', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="retAid">Ret.Aid</Label>
                    <Input
                      id="retAid"
                      type="text"
                      value={formData.retAid}
                      onChange={(e) => handleInputChange('retAid', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="colourDye">Colour Dye</Label>
                    <Input
                      id="colourDye"
                      type="text"
                      value={formData.colourDye}
                      onChange={(e) => handleInputChange('colourDye', e.target.value)}
                      disabled={isOtherFieldDisabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="shutdownHours">Shutdown Hours</Label>
                    <Input
                      id="shutdownHours"
                      type="text"
                      value={formData.shutdownHours}
                      onChange={(e) => handleInputChange('shutdownHours', e.target.value)}
                      disabled={isFormDisabled}
                    />
                  </div>
                </div>
              </form>
            )}

            {/* Edit mode: show message when no data loaded */}
            {mode === "edit" && !dataLoaded && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                Select a date and click "Load Data" to edit existing production data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
