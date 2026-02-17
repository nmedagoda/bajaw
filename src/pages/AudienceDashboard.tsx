import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  uploaded_song: {
    id: string;
    song_title: string;
    original_singer_name: string;
    singer_id: string;
    profiles: {
      full_name: string;
    } | null;
  };
}

const AudienceDashboard = () => {
  const { t } = useTranslation();
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
      
      // Get votes with uploaded_songs and singer profile data
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select(`
          id, 
          voice_score, 
          overall_score, 
          score, 
          created_at, 
          performance_id
        `)
        .eq("voter_id", user?.id)
        .order("created_at", { ascending: false });

      if (votesError) throw votesError;

      // Fetch uploaded_songs and singer details for each vote
      const votesWithSongs = await Promise.all(
        (votes || []).map(async (vote) => {
          const { data: uploadedSong, error: songError } = await supabase
            .from("uploaded_songs")
            .select("id, song_title, original_singer_name, singer_id")
            .eq("id", vote.performance_id)
            .maybeSingle();

          if (songError) {
            console.error("Error fetching uploaded song:", songError);
          }

          let singerName = "Unknown Singer";
          if (uploadedSong?.singer_id) {
            const { data: profile, error: profileError } = await supabase
              .from("public_profiles")
              .select("full_name")
              .eq("id", uploadedSong.singer_id)
              .maybeSingle();
            
            if (profileError) {
              console.error("Error fetching profile:", profileError);
            }
            
            singerName = profile?.full_name || "Unknown Singer";
          }

          return {
            ...vote,
            uploaded_song: {
              id: uploadedSong?.id || "",
              song_title: uploadedSong?.song_title || "Untitled",
              original_singer_name: uploadedSong?.original_singer_name || "",
              singer_id: uploadedSong?.singer_id || "",
              profiles: {
                full_name: singerName,
              },
            },
          };
        })
      );

      setVoteHistory(votesWithSongs);
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
          <CardTitle>{t('audience.votingHistory')}</CardTitle>
          <CardDescription>{t('audience.votingHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {voteHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('audience.noVotesYet')}</p>
              <p className="mt-2">{t('audience.visitPerformances')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('audience.dateVoted')}</TableHead>
                    <TableHead>{t('audience.singerCol')}</TableHead>
                    <TableHead>{t('audience.songTitleCol')}</TableHead>
                    <TableHead className="text-center">{t('audience.voiceScore')}</TableHead>
                    <TableHead className="text-center">{t('audience.overallScore')}</TableHead>
                    <TableHead className="text-center">{t('audience.average')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voteHistory.map((vote) => (
                    <TableRow key={vote.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(vote.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {vote.uploaded_song?.profiles?.full_name || "Unknown Singer"}
                      </TableCell>
                      <TableCell>{vote.uploaded_song?.song_title || "Untitled"}</TableCell>
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
