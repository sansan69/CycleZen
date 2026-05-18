
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import {
  GoogleMap,
  Polyline,
  Marker,
} from "@react-google-maps/api";

import { db } from "@/lib/firebase";
import { onAuthUserChanged } from "@/features/auth/services/auth-service";
import type { Coordinate } from "@/features/route-generation/services/open-route-service";
import { formatDuration } from "@/shared/lib/utils";
import {
  estimateFTP,
  calculateWeeklyLoad,
  buildTrainingLoadData,
  type CompletedRide,
  type WeeklyLoadResult,
  type TrainingLoadData,
} from "@/shared/lib/training";
import { TrainingLoadChart } from "@/features/dashboard/components/TrainingLoadChart";
import { useGoogleMaps } from "@/features/map/hooks/useGoogleMaps";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
import { EmptyState } from "@/shared/components/EmptyState";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { AchievementsList } from "@/features/achievements";
import { fetchAchievements } from "@/features/achievements";
import type { Achievement } from "@/features/achievements";

interface CompletedRideData {
  routeName: string;
  completedAt: Timestamp;
  actualDurationSeconds: number;
  plannedDistanceKm: number;
  actualDistanceCoveredKm?: number;
  estimatedCalories: number;
  routeCoordinates: Coordinate[];
  ascent?: number;
}

interface CompletedRideDoc extends CompletedRideData {
  id: string;
}

const DashboardPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [completedRides, setCompletedRides] = useState<CompletedRideDoc[]>([]);
  const [loadingRides, setLoadingRides] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    totalRides: 0,
    totalDistance: 0,
    totalDurationSeconds: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState<boolean>(true);
  const { toast } = useToast();

  const { isLoaded, loadError, googleMapsApiKey } = useGoogleMaps();

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && db) {
      setLoadingRides(true);
      const completedRidesCollection = collection(
        db,
        "users",
        currentUser.uid,
        "rides"
      );
      const q = query(completedRidesCollection, orderBy("completedAt", "desc"));

      getDocs(q)
        .then((querySnapshot) => {
          const completedRides: CompletedRideDoc[] = [];
          let totalDistance = 0;
          let totalDurationSeconds = 0;

          querySnapshot.forEach((doc) => {
            const data = doc.data() as CompletedRideData;
            completedRides.push({ id: doc.id, ...data });
            totalDistance += data.actualDistanceCoveredKm ?? data.plannedDistanceKm;
            totalDurationSeconds += data.actualDurationSeconds;
          });
          
          setCompletedRides(completedRides);
          setStats({
            totalRides: completedRides.length,
            totalDistance: totalDistance,
            totalDurationSeconds: totalDurationSeconds,
          });
          setLoadingRides(false);
        })
        .catch((error) => {
          console.error("Error fetching completed rides:", error);
          toast({
            title: "Error",
            description: "Could not fetch completed rides.",
            variant: "destructive",
          });
          setLoadingRides(false);
        });
    } else if (!currentUser && !authLoading) {
      setLoadingRides(false);
    }
  }, [currentUser, authLoading, toast]);

  // Fetch achievements
  useEffect(() => {
    if (currentUser) {
      setLoadingAchievements(true);
      fetchAchievements(currentUser.uid)
        .then((data) => {
          setAchievements(data);
          setLoadingAchievements(false);
        })
        .catch((error) => {
          console.error("Error fetching achievements:", error);
          setLoadingAchievements(false);
        });
    } else if (!currentUser && !authLoading) {
      setLoadingAchievements(false);
      setAchievements([]);
    }
  }, [currentUser, authLoading]);

  const onMapLoad = useCallback((map: google.maps.Map, coordinates: Coordinate[]) => {
    if (coordinates && coordinates.length > 0 && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      coordinates.forEach((coord) => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      map.fitBounds(bounds);
    }
  }, []);

  const mapContainerStyle = {
    height: "200px",
    width: "100%",
  };

  // ── Training Metrics ──────────────────────────────────
  const trainingLoadData = useMemo<TrainingLoadData[]>(() => {
    if (!completedRides.length) return [];
    return buildTrainingLoadData(completedRides as CompletedRide[], 14);
  }, [completedRides]);

  const ftp = useMemo(() => {
    if (!completedRides.length) return 0;
    return estimateFTP(completedRides as CompletedRide[]);
  }, [completedRides]);

  const weeklyLoad = useMemo<WeeklyLoadResult>(() => {
    if (!completedRides.length) {
      return { load: 0, trend: "→", trendLabel: "stable", recommendation: "" };
    }
    return calculateWeeklyLoad(completedRides as CompletedRide[], ftp);
  }, [completedRides, ftp]);

  const trendIcon = useMemo(() => {
    switch (weeklyLoad.trend) {
      case "↑":
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "↓":
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-yellow-500" />;
    }
  }, [weeklyLoad.trend]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8">
        <Icons.spinner className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8 text-center">
        <Icons.user className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-3xl font-bold text-primary mb-2">Access Denied</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Please log in to view your dashboard.
        </p>
        <Button asChild variant="accent">
          <Link href="/">Return to Home & Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
        <Toaster />
        <header className="w-full max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-primary">My Dashboard</h1>
            <Button asChild variant="outline">
              <Link href="/">
                <Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Link>
            </Button>
          </div>
        </header>

        <main className="container mx-auto max-w-4xl">
          {/* Achievements Section */}
          <section className="mb-8">
            <AchievementsList
              achievements={achievements}
              loading={loadingAchievements}
            />
          </section>

          {/* Stats Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Overall Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card shadow">
                <CardHeader>
                  <CardTitle className="text-primary text-lg">Total Rides</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingRides ? <Skeleton className="h-8 w-1/2" /> : <p className="text-3xl font-bold">{stats.totalRides}</p>}
                </CardContent>
              </Card>
              <Card className="bg-card shadow">
                <CardHeader>
                  <CardTitle className="text-primary text-lg">Total Distance</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingRides ? <Skeleton className="h-8 w-1/2" /> : <p className="text-3xl font-bold">{stats.totalDistance.toFixed(1)} km</p>}
                </CardContent>
              </Card>
              <Card className="bg-card shadow">
                <CardHeader>
                  <CardTitle className="text-primary text-lg">Total Time Riding</CardTitle>
                </CardHeader>
                <CardContent>
                   {loadingRides ? <Skeleton className="h-8 w-1/2" /> : <p className="text-3xl font-bold">{formatDuration(stats.totalDurationSeconds)}</p>}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Past Rides Section */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Past Rides</h2>
            {loadingRides && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[300px] w-full rounded-lg" />)}
              </div>
            )}

            {!loadingRides && completedRides.length === 0 && (
              <EmptyState
                icon="bike"
                title="No completed rides yet."
                description="Go find some routes and start riding!"
              />
            )}

            {!loadingRides && completedRides.length > 0 && (
              <div className="space-y-6">
                {completedRides.map((ride) => (
                  <Card key={ride.id} className="bg-card shadow-lg rounded-lg overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-primary">{ride.routeName}</CardTitle>
                      <CardDescription>
                        Completed on: {new Date(ride.completedAt.toDate()).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">Duration</p>
                          <p className="text-muted-foreground">{formatDuration(ride.actualDurationSeconds)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Distance</p>
                          <p className="text-muted-foreground">
                            {(ride.actualDistanceCoveredKm ?? ride.plannedDistanceKm).toFixed(1)} km
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Est. Calories</p>
                          <p className="text-muted-foreground">{ride.estimatedCalories.toLocaleString()}</p>
                        </div>
                         {ride.ascent !== undefined && isFinite(ride.ascent) && (
                            <div>
                                <p className="font-medium text-foreground">Elevation Gain</p>
                                <p className="text-muted-foreground">{ride.ascent.toFixed(0)} m</p>
                            </div>
                         )}
                      </div>
                      {isLoaded && googleMapsApiKey && ride.routeCoordinates && ride.routeCoordinates.length > 0 ? (
                        <div className="rounded-md overflow-hidden border border-border mt-2">
                          <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: false,
                              fullscreenControl: true,
                              gestureHandling: 'cooperative'
                            }}
                            onLoad={(map) => onMapLoad(map, ride.routeCoordinates)}
                          >
                            <Polyline
                              path={ride.routeCoordinates}
                              options={{
                                strokeColor: "hsl(var(--primary))",
                                strokeWeight: 3,
                                strokeOpacity: 0.8,
                              }}
                            />
                            <Marker position={ride.routeCoordinates[0]} />
                          </GoogleMap>
                        </div>
                      ) : loadError ? (
                         <p className="text-sm text-destructive">Map could not be loaded.</p>
                      ) : (
                        <Skeleton className="h-[200px] w-full bg-muted mt-2 rounded-md" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Training Metrics Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Training Metrics</h2>
            {loadingRides ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-[200px] w-full rounded-lg" />
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </div>
            ) : completedRides.length === 0 ? (
              <EmptyState
                icon="activity"
                title="Need more rides"
                description="Complete some rides to unlock training metrics and load tracking."
              />
            ) : (
              <>
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* FTP Estimate */}
                  <Card className="bg-card shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-primary text-sm font-medium">
                        Est. FTP
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{ftp} W</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on your best avg speed
                      </p>
                    </CardContent>
                  </Card>

                  {/* Weekly TSS */}
                  <Card className="bg-card shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-primary text-sm font-medium">
                        Weekly TSS
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{weeklyLoad.load}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Past 7 days &middot; {weeklyLoad.trendLabel}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Training Load Trend */}
                  <Card className="bg-card shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-primary text-sm font-medium">
                        Load Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3">
                      {trendIcon}
                      <div>
                        <p className="text-lg font-semibold capitalize">
                          {weeklyLoad.trendLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          vs previous week
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recovery Recommendation */}
                  <Card className="bg-card shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-primary text-sm font-medium">
                        Recovery
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">
                        {weeklyLoad.recommendation || "Complete a ride to get recovery insights."}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Training Load Chart */}
                <Card className="bg-card shadow">
                  <CardHeader>
                    <CardTitle className="text-primary text-lg">
                      Training Load (14 Days)
                    </CardTitle>
                    <CardDescription>
                      Daily Training Stress Score
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrainingLoadChart data={trainingLoadData} />
                  </CardContent>
                </Card>
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
};

export default DashboardPage;

