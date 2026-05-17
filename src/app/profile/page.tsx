
"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { db } from "@/lib/firebase";
import { onAuthUserChanged } from "@/features/auth/services/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

const profileFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }).max(30, { message: "Username must not exceed 30 characters." }),
  bio: z.string().max(160, { message: "Bio must not exceed 160 characters." }).optional(),
  email: z.string().email().optional(), // Email will be read-only from auth
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ProfilePage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: "",
      bio: "",
      email: "",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user && user.email) {
        form.setValue("email", user.email); // Set email from auth, it's read-only
      }
    });
    return () => unsubscribe();
  }, [form]);

  useEffect(() => {
    if (currentUser && db) {
      setProfileLoading(true);
      const userDocRef = doc(db, "users", currentUser.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({
              username: data.username || "",
              bio: data.bio || "",
              email: currentUser.email || "", // Ensure email is from auth
            });
          } else {
            // No profile yet, keep defaults (blank username/bio, email from auth)
            form.reset({
                username: "",
                bio: "",
                email: currentUser.email || "",
            })
          }
        })
        .catch((error) => {
          console.error("Error fetching user profile:", error);
          toast({
            title: "Error",
            description: "Could not fetch your profile data.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setProfileLoading(false);
        });
    } else if (!currentUser && !authLoading) {
        setProfileLoading(false); // Not logged in, no profile to load
    }
  }, [currentUser, authLoading, form, toast]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!currentUser || !db) {
      toast({ title: "Error", description: "User not logged in or database unavailable.", variant: "destructive" });
      return;
    }

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(userDocRef, {
        username: data.username,
        bio: data.bio,
        email: currentUser.email, // Always store the auth email
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // Consider adding this only if doc doesn't exist
      }, { merge: true }); // Merge true to create if not exists, or update if exists

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Error", description: "Failed to update profile. Please try again.", variant: "destructive" });
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8">
        <Icons.spinner className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {authLoading ? "Loading authentication..." : "Loading profile..."}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8 text-center">
        <Icons.userCog className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-3xl font-bold text-primary mb-2">Access Denied</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Please log in to view and edit your profile.
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
        <header className="w-full max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-primary">Edit Profile</h1>
            <Button asChild variant="outline">
              <Link href="/"><Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
            </Button>
          </div>
        </header>

        <main className="container mx-auto max-w-2xl">
          <Card className="bg-card shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle>Your Profile Information</CardTitle>
              <CardDescription>Update your username and bio.</CardDescription>
            </CardHeader>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <CardContent className="space-y-6">
                  {/* Placeholder for Profile Picture - Future Feature
                  <div className="flex flex-col items-center space-y-2">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src="https://placehold.co/100x100.png" alt="@shadcn" data-ai-hint="profile avatar" />
                      <AvatarFallback>{currentUser.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" size="sm" disabled>Change Picture (Coming Soon)</Button>
                  </div>
                  */}
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly disabled className="bg-muted/50"/>
                        </FormControl>
                        <FormDescription>Your email address (cannot be changed here).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Your public username" {...field} />
                        </FormControl>
                        <FormDescription>This is your public display name.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us a little bit about yourself and your cycling adventures!"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A short bio (max 160 characters).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile
                  </Button>
                </CardFooter>
              </form>
            </FormProvider>
          </Card>
        </main>
      </div>
    </>
  );
};

export default ProfilePage;
