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
import { Calendar, Factory, Save, Loader2 } from "lucide-react";
import { PRODUCTION_DATA_ENDPOINTS } from "@/lib/api-config";

export default function ProductionDataPage() {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    production: "",
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
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch data when date changes
  useEffect(() => {
    if (formData.date) {
      fetchProductionData(formData.date);
    }
  }, [formData.date]);

  const fetchProductionData = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        PRODUCTION_DATA_ENDPOINTS.PRODUCTION_DATA_BY_DATE(date),
        {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }
      );

      if (response.status === 404) {
        // No data for this date, reset form fields (except date)
        setFormData(prev => ({
          date: prev.date,
          production: "",
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
        }));
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch production data');
      }

      const data = await response.json();

      // Populate form with existing data
      setFormData({
        date: date,
        production: data.production?.toString() || "",
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
      });

      toast.info("Loaded existing data for selected date");
    } catch (err) {
      // Silently handle - no toast for 404
      if (err instanceof Error && !err.message.includes('404')) {
        console.error('Error fetching production data:', err);
      }
    } finally {
      setLoading(false);
    }
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      // Prepare data for API (convert empty strings to null)
      const apiData = {
        date: new Date(formData.date).toISOString(),
        production: formData.production || null,
        electricity: formData.electricity || null,
        coal: formData.coal || null,
        bhushi: formData.bhushi || null,
        dispatch_ton: formData.dispatchTon || null,
        po_ton: formData.poTon || null,
        waste: formData.waste || null,
        starch: formData.starch || null,
        guar_gum: formData.guarGum || null,
        pac: formData.pac || null,
        rct: formData.rct || null,
        s_seizing: formData.sSeizing || null,
        d_former: formData.dFormer || null,
        sodium_silicate: formData.sodiumSilicate || null,
        enzyme: formData.enzyme || null,
        dsr: formData.dsr || null,
        ret_aid: formData.retAid || null,
        colour_dye: formData.colourDye || null,
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

      toast.success("Production data saved successfully!");

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
      date: new Date().toISOString().split('T')[0],
      production: "",
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
    });
    toast.info("Form reset");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="w-8 h-8 text-primary" />
              Production Data Entry
            </h1>
            <p className="text-muted-foreground">
              Enter daily production and consumption data
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Production Form</CardTitle>
            <CardDescription>
              Fill in all the production metrics for the day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="production">Production</Label>
                  <Input
                    id="production"
                    type="text"
                    value={formData.production}
                    onChange={(e) => handleInputChange('production', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="electricity">Electricity</Label>
                  <Input
                    id="electricity"
                    type="text"
                    value={formData.electricity}
                    onChange={(e) => handleInputChange('electricity', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="coal">Coal</Label>
                  <Input
                    id="coal"
                    type="text"
                    value={formData.coal}
                    onChange={(e) => handleInputChange('coal', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bhushi">Bhushi</Label>
                  <Input
                    id="bhushi"
                    type="text"
                    value={formData.bhushi}
                    onChange={(e) => handleInputChange('bhushi', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dispatchTon">Dispatch (Ton)</Label>
                  <Input
                    id="dispatchTon"
                    type="text"
                    value={formData.dispatchTon}
                    onChange={(e) => handleInputChange('dispatchTon', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="poTon">PO (Ton)</Label>
                  <Input
                    id="poTon"
                    type="text"
                    value={formData.poTon}
                    onChange={(e) => handleInputChange('poTon', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="waste">Waste</Label>
                  <Input
                    id="waste"
                    type="text"
                    value={formData.waste}
                    onChange={(e) => handleInputChange('waste', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="starch">Starch</Label>
                  <Input
                    id="starch"
                    type="text"
                    value={formData.starch}
                    onChange={(e) => handleInputChange('starch', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="guarGum">Guar Gum</Label>
                  <Input
                    id="guarGum"
                    type="text"
                    value={formData.guarGum}
                    onChange={(e) => handleInputChange('guarGum', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pac">PAC</Label>
                  <Input
                    id="pac"
                    type="text"
                    value={formData.pac}
                    onChange={(e) => handleInputChange('pac', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="rct">RCT</Label>
                  <Input
                    id="rct"
                    type="text"
                    value={formData.rct}
                    onChange={(e) => handleInputChange('rct', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sSeizing">S.Seizing</Label>
                  <Input
                    id="sSeizing"
                    type="text"
                    value={formData.sSeizing}
                    onChange={(e) => handleInputChange('sSeizing', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dFormer">D.Former</Label>
                  <Input
                    id="dFormer"
                    type="text"
                    value={formData.dFormer}
                    onChange={(e) => handleInputChange('dFormer', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sodiumSilicate">Sodium Silicate</Label>
                  <Input
                    id="sodiumSilicate"
                    type="text"
                    value={formData.sodiumSilicate}
                    onChange={(e) => handleInputChange('sodiumSilicate', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="enzyme">Enzyme</Label>
                  <Input
                    id="enzyme"
                    type="text"
                    value={formData.enzyme}
                    onChange={(e) => handleInputChange('enzyme', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dsr">D.S.R.</Label>
                  <Input
                    id="dsr"
                    type="text"
                    value={formData.dsr}
                    onChange={(e) => handleInputChange('dsr', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retAid">Ret.Aid</Label>
                  <Input
                    id="retAid"
                    type="text"
                    value={formData.retAid}
                    onChange={(e) => handleInputChange('retAid', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="colourDye">Colour Dye</Label>
                  <Input
                    id="colourDye"
                    type="text"
                    value={formData.colourDye}
                    onChange={(e) => handleInputChange('colourDye', e.target.value)}
                    disabled={loading || saving}
                  />
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={loading || saving}
                >
                  Reset
                </Button>
                <Button type="submit" className="flex items-center gap-2" disabled={loading || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Data
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
