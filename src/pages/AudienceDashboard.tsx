import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

interface VoteHistory {
  id: string;
  voice_score: number | null;
  overall_score: number | null;
  score: number;
  created_at: string;
  performance: {
    id: string;
    title: string;
    singer_id: string;
    profiles: {
      full_name: string;
    } | null;
  };
}

const AudienceDashboard = () => {
  const { user } = useAuth();
  const [voteHistory, setVoteHistory] = useState<VoteHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchVoteHistory();
    }
  }, [user]);

  const fetchVoteHistory = async () => {
    try {
      setLoading(true);
      
      // First get all votes for this user
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("id, voice_score, overall_score, score, created_at, performance_id")
        .eq("voter_id", user?.id)
        .order("created_at", { ascending: false });

      if (votesError) throw votesError;

      // Then fetch performance and singer details for each vote
      const votesWithPerformances = await Promise.all(
        (votes || []).map(async (vote) => {
          const { data: performance, error: perfError } = await supabase
            .from("performances")
            .select("id, title, singer_id")
            .eq("id", vote.performance_id)
            .maybeSingle();

          if (perfError) {
            console.error("Error fetching performance:", perfError);
          }

          let singerName = "Unknown Singer";
          if (performance?.singer_id) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", performance.singer_id)
              .maybeSingle();
            
            if (profileError) {
              console.error("Error fetching profile:", profileError);
            }
            
            singerName = profile?.full_name || "Unknown Singer";
          }

          return {
            ...vote,
            performance: {
              id: performance?.id || "",
              title: performance?.title || "Untitled",
              singer_id: performance?.singer_id || "",
              profiles: {
                full_name: singerName,
              },
            },
          };
        })
      );

      setVoteHistory(votesWithPerformances);
    } catch (error) {
      console.error("Error fetching vote history:", error);
      toast.error("Failed to load voting history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>My Voting History</CardTitle>
          <CardDescription>
            Performances you've watched and voted on
          </CardDescription>
        </CardHeader>
        <CardContent>
          {voteHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>You haven't voted on any performances yet.</p>
              <p className="mt-2">Visit the Performances page to start voting!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Voted</TableHead>
                    <TableHead>Singer</TableHead>
                    <TableHead>Song Title</TableHead>
                    <TableHead className="text-center">Voice Score</TableHead>
                    <TableHead className="text-center">Overall Score</TableHead>
                    <TableHead className="text-center">Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voteHistory.map((vote) => (
                    <TableRow key={vote.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(vote.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {vote.performance?.profiles?.full_name || "Unknown Singer"}
                      </TableCell>
                      <TableCell>{vote.performance?.title || "Untitled"}</TableCell>
                      <TableCell className="text-center">
                        {vote.voice_score !== null ? vote.voice_score : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {vote.overall_score !== null ? vote.overall_score : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {vote.score}
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
};

export default AudienceDashboard;
