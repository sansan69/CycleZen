
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  updateDoc, // Added
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { onAuthUserChanged } from "@/lib/firebaseAuthService";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, // Added
  DialogContent, // Added
  DialogDescription, // Added
  DialogFooter, // Added
  DialogHeader, // Added
  DialogTitle, // Added
  DialogTrigger, // Added (though we'll trigger programmatically)
  DialogClose, // Added
} from "@/components/ui/dialog"; // Added
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added
import { Textarea } from "@/components/ui/textarea"; // Added
import { Label } from "@/components/ui/label"; // Added
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface SavedRouteDoc {
  id: string;
  routeData: {
    distance: number;
    estimatedTime: number;
    ascent?: number;
  };
  timestamp: Timestamp;
  routeName: string;
  sharedUrl: string;
  notes?: string; // Added optional notes field
}

const SavedRoutesPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteDoc[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const { toast } = useToast();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [routeToDeleteId, setRouteToDeleteId] = useState<string | null>(null);

  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<SavedRouteDoc | null>(null);
  const [editedRouteName, setEditedRouteName] = useState("");
  const [editedRouteNotes, setEditedRouteNotes] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && db) {
      setLoadingRoutes(true);
      const routesCollection = collection(
        db,
        "users",
        currentUser.uid,
        "savedRoutes"
      );
      const q = query(routesCollection, orderBy("timestamp", "desc"));

      getDocs(q)
        .then((querySnapshot) => {
          const routes: SavedRouteDoc[] = [];
          querySnapshot.forEach((doc) => {
            routes.push({ id: doc.id, ...doc.data() } as SavedRouteDoc);
          });
          setSavedRoutes(routes);
          setLoadingRoutes(false);
        })
        .catch((error) => {
          console.error("Error fetching saved routes:", error);
          toast({
            title: "Error",
            description: "Could not fetch saved routes.",
            variant: "destructive",
          });
          setLoadingRoutes(false);
        });
    } else if (!currentUser && !authLoading) {
      setLoadingRoutes(false);
    }
  }, [currentUser, authLoading, toast]);

  const handleShareRoute = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied!",
        description: "Route link copied to clipboard.",
      });
    } catch (err) {
      console.error("Failed to copy link: ", err);
      toast({
        title: "Copy Error",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (routeId: string) => {
    setRouteToDeleteId(routeId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!routeToDeleteId || !currentUser || !db) {
      toast({
        title: "Error",
        description: "Could not delete route. Missing information.",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setRouteToDeleteId(null);
      return;
    }

    try {
      const routeDocRef = doc(db, "users", currentUser.uid, "savedRoutes", routeToDeleteId);
      await deleteDoc(routeDocRef);

      setSavedRoutes((prevRoutes) =>
        prevRoutes.filter((route) => route.id !== routeToDeleteId)
      );

      toast({
        title: "Route Deleted",
        description: "The route has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting route:", error);
      toast({
        title: "Delete Error",
        description: "Failed to delete route. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setRouteToDeleteId(null);
    }
  };

  const handleEditClick = (route: SavedRouteDoc) => {
    setRouteToEdit(route);
    setEditedRouteName(route.routeName);
    setEditedRouteNotes(route.notes || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!routeToEdit || !currentUser || !db) {
      toast({
        title: "Error",
        description: "Could not save changes. Missing information.",
        variant: "destructive",
      });
      return;
    }
    if (!editedRouteName.trim()) {
      toast({
        title: "Validation Error",
        description: "Route name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    try {
      const routeDocRef = doc(db, "users", currentUser.uid, "savedRoutes", routeToEdit.id);
      await updateDoc(routeDocRef, {
        routeName: editedRouteName.trim(),
        notes: editedRouteNotes.trim(),
      });

      setSavedRoutes((prevRoutes) =>
        prevRoutes.map((route) =>
          route.id === routeToEdit.id
            ? { ...route, routeName: editedRouteName.trim(), notes: editedRouteNotes.trim() }
            : route
        )
      );

      toast({
        title: "Changes Saved",
        description: "Your route details have been updated.",
      });
      setIsEditDialogOpen(false);
      setRouteToEdit(null);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({
        title: "Save Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };


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
          Please log in to view your saved routes.
        </p>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/">Return to Home & Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
        <Toaster />
        <header className="w-full max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
              <h1 className="text-4xl font-bold text-primary">My Saved Routes</h1>
              <Button asChild variant="outline">
                <Link href="/"><Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
              </Button>
          </div>
        </header>

        <main className="container mx-auto max-w-2xl">
          {loadingRoutes && (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          )}

          {!loadingRoutes && savedRoutes.length === 0 && (
            <div className="text-center py-10">
              <Icons.list className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">
                No saved routes yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Go back to the homepage to generate and save new routes!
              </p>
            </div>
          )}

          {!loadingRoutes && savedRoutes.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
              {savedRoutes.map((route) => (
                <Card key={route.id} className="bg-card shadow-lg rounded-lg">
                  <CardHeader>
                    <CardTitle className="text-primary">{route.routeName}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Saved on: {new Date(route.timestamp.toDate()).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-2 text-sm">
                        <div className="flex items-center">
                            <Icons.route className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div>
                            <p className="font-semibold text-base">{route.routeData.distance.toFixed(1)} km</p>
                            <p className="text-xs text-muted-foreground">Distance</p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Icons.clock className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div>
                            <p className="font-semibold text-base">{route.routeData.estimatedTime.toFixed(0)} min</p>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            </div>
                        </div>
                         {route.routeData.ascent !== undefined && (
                            <div className="flex items-center">
                                <Icons.mountain className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <div>
                                <p className="font-semibold text-base">{route.routeData.ascent.toFixed(0)} m</p>
                                <p className="text-xs text-muted-foreground">Elevation</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {route.notes && (
                      <div className="pt-2">
                        <p className="text-sm font-medium text-foreground">Notes:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{route.notes}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
                    <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent/10">
                      <a href={route.sharedUrl} target="_blank" rel="noopener noreferrer">
                        <Icons.externalLink className="mr-2 h-4 w-4" /> Open in Google Maps
                      </a>
                    </Button>
                    <div className="flex gap-2">
                       <Button 
                        onClick={() => handleEditClick(route)} 
                        variant="outline" 
                        className="hover:bg-secondary/80"
                      >
                        <Icons.edit className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button 
                        onClick={() => handleShareRoute(route.sharedUrl)} 
                        variant="outline" 
                        className="hover:bg-secondary/80"
                      >
                        <Icons.share className="mr-2 h-4 w-4" /> Share
                      </Button>
                       <Button 
                        onClick={() => handleDeleteClick(route.id)} 
                        variant="destructive" 
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Icons.trash className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this saved route.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRouteToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Route Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Route Details</DialogTitle>
            <DialogDescription>
              Make changes to your saved route here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {routeToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="routeName" className="text-right">
                  Name
                </Label>
                <Input
                  id="routeName"
                  value={editedRouteName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditedRouteName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="routeNotes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="routeNotes"
                  value={editedRouteNotes}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditedRouteNotes(e.target.value)}
                  className="col-span-3 min-h-[100px]"
                  placeholder="Add any notes about this route..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveChanges} variant="accent">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SavedRoutesPage;

    