"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calculator, Calendar, TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export default function HourCalculatorPage() {
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [startAmPm, setStartAmPm] = useState("AM");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endAmPm, setEndAmPm] = useState("AM");
  const [result, setResult] = useState<{
    hours: number;
    days: number;
    totalMinutes: number;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        router.push("/auth/login");
      }
    };

    checkAuth();
  }, [router]);

  const convertTo24Hour = (time12h: string, ampm: string) => {
    const [hours, minutes] = time12h.split(':');
    let hour24 = parseInt(hours);

    if (ampm === 'AM' && hour24 === 12) {
      hour24 = 0;
    } else if (ampm === 'PM' && hour24 !== 12) {
      hour24 += 12;
    }

    return `${hour24.toString().padStart(2, '0')}:${minutes}`;
  };

  const calculateHours = () => {
    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error("Please fill in all date and time fields");
      return;
    }

    const startTime24 = convertTo24Hour(startTime, startAmPm);
    const endTime24 = convertTo24Hour(endTime, endAmPm);

    const start = new Date(`${startDate}T${startTime24}`);
    const end = new Date(`${endDate}T${endTime24}`);

    if (end <= start) {
      toast.error("End date time must be after start date time");
      return;
    }

    const diffInMs = end.getTime() - start.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;

    setResult({
      hours: Math.round(diffInHours * 100) / 100, // Round to 2 decimal places
      days: Math.round(diffInDays * 100) / 100,
      totalMinutes: diffInMinutes
    });

    toast.success("Hours calculated successfully!");
  };

  const clearCalculation = () => {
    setStartDate("");
    setStartTime("");
    setStartAmPm("AM");
    setEndDate("");
    setEndTime("");
    setEndAmPm("AM");
    setResult(null);
  };

  const setCurrentDateTime = (isStart: boolean) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');

    let hour12 = hours;
    let ampm = 'AM';

    if (hours === 0) {
      hour12 = 12;
    } else if (hours > 12) {
      hour12 = hours - 12;
      ampm = 'PM';
    } else if (hours === 12) {
      ampm = 'PM';
    }

    const formattedTime = `${String(hour12).padStart(2, '0')}:${minutes}`;
    const formattedDate = `${year}-${month}-${day}`;

    if (isStart) {
      setStartDate(formattedDate);
      setStartTime(formattedTime);
      setStartAmPm(ampm);
    } else {
      setEndDate(formattedDate);
      setEndTime(formattedTime);
      setEndAmPm(ampm);
    }
  };

  const formatDateTime12Hour = (date: string, time: string, ampm: string) => {
    if (!date || !time) return 'Not set';
    const formattedDate = new Date(date).toLocaleDateString('en-US');
    return `${formattedDate}, ${time} ${ampm}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calculator className="w-8 h-8 text-primary" />
              Hour Calculator
            </h1>
            <p className="text-muted-foreground">
              Calculate the difference between start and end date times
            </p>
          </div>
        </div>

        {/* Main Calculator Card */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Time Input
              </CardTitle>
              <CardDescription>
                Select start and end date times to calculate the difference
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Start Date & Time
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="startDate" className="text-sm text-muted-foreground">Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Hour</Label>
                    <Select value={startTime.split(':')[0] || ''} onValueChange={(hour) => setStartTime(`${hour}:${startTime.split(':')[1] || '00'}`)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_, i) => i + 1).map(hour => (
                          <SelectItem key={hour} value={hour.toString().padStart(2, '0')}>
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Minutes</Label>
                    <Select value={startTime.split(':')[1] || ''} onValueChange={(minute) => setStartTime(`${startTime.split(':')[0] || '01'}:${minute}`)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 60}, (_, i) => i).map(minute => (
                          <SelectItem key={minute} value={minute.toString().padStart(2, '0')}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">AM/PM</Label>
                    <Select value={startAmPm} onValueChange={setStartAmPm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDateTime(true)}
                  className="text-xs"
                >
                  Use Current Time
                </Button>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  End Date & Time
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="endDate" className="text-sm text-muted-foreground">Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Hour</Label>
                    <Select value={endTime.split(':')[0] || ''} onValueChange={(hour) => setEndTime(`${hour}:${endTime.split(':')[1] || '00'}`)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_, i) => i + 1).map(hour => (
                          <SelectItem key={hour} value={hour.toString().padStart(2, '0')}>
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Minutes</Label>
                    <Select value={endTime.split(':')[1] || ''} onValueChange={(minute) => setEndTime(`${endTime.split(':')[0] || '01'}:${minute}`)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 60}, (_, i) => i).map(minute => (
                          <SelectItem key={minute} value={minute.toString().padStart(2, '0')}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">AM/PM</Label>
                    <Select value={endAmPm} onValueChange={setEndAmPm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDateTime(false)}
                  className="text-xs"
                >
                  Use Current Time
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={calculateHours}
                  className="flex-1"
                  disabled={!startDate || !startTime || !endDate || !endTime}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate Hours
                </Button>
                <Button
                  variant="outline"
                  onClick={clearCalculation}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TimerIcon className="w-5 h-5" />
                Calculation Result
              </CardTitle>
              <CardDescription>
                Time difference breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
                      <span className="font-medium">Total Time:</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {Math.floor(result.hours)} hours {result.totalMinutes % 60} minutes
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Total Days:</span>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {result.days} days
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Total Minutes:</span>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {result.totalMinutes} minutes
                      </Badge>
                    </div>
                  </div>

                  {/* Formatted breakdown */}
                  <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Detailed Breakdown:</h4>
                    <div className="text-sm space-y-1">
                      <p>• {Math.floor(result.days)} days, {Math.floor(result.hours % 24)} hours, {result.totalMinutes % 60} minutes</p>
                      <p>• Start: {formatDateTime12Hour(startDate, startTime, startAmPm)}</p>
                      <p>• End: {formatDateTime12Hour(endDate, endTime, endAmPm)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Calculation Yet</h3>
                  <p className="text-muted-foreground">
                    Select start and end times, then click "Calculate Hours" to see the results
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}