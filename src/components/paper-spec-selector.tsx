import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import { fetchPapers, type Paper } from '@/lib/papers';

export interface PaperSpecification {
  id: string;
  gsm: number;
  bf: number;
  shade: string;
  name: string;
}

interface PaperSpecSelectorProps {
  value?: string;
  onValueChange: (spec: PaperSpecification | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PaperSpecSelector({
  value,
  onValueChange,
  placeholder = "Select paper specification...",
  disabled = false
}: PaperSpecSelectorProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch papers on component mount
  useEffect(() => {
    const loadPapers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const papersData = await fetchPapers();

        // Filter active papers and sort by GSM, then BF, then shade
        const activePapers = papersData
          .filter(paper => paper.status === 'active')
          .sort((a, b) => {
            // First sort by GSM
            if (a.gsm !== b.gsm) return a.gsm - b.gsm;
            // Then by BF
            if (a.bf !== b.bf) return a.bf - b.bf;
            // Finally by shade alphabetically
            return a.shade.localeCompare(b.shade);
          });

        setPapers(activePapers);
      } catch (err) {
        console.error('Failed to load papers:', err);
        setError('Failed to load paper specifications');
      } finally {
        setIsLoading(false);
      }
    };

    loadPapers();
  }, []);

  // Find selected paper
  const selectedPaper = papers.find(paper => paper.id === value);

  const handleValueChange = (paperId: string) => {
    const paper = papers.find(p => p.id === paperId);
    if (paper) {
      onValueChange({
        id: paper.id,
        gsm: paper.gsm,
        bf: paper.bf,
        shade: paper.shade,
        name: paper.name
      });
    } else {
      onValueChange(null);
    }
  };

  // Format paper specification as "110gsm, 18bf, natural"
  const formatPaperSpec = (paper: Paper): string => {
    return `${paper.gsm}gsm, ${paper.bf}bf, ${paper.shade.toLowerCase()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading specifications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-10 border rounded-md bg-destructive/10">
        <span className="text-sm text-destructive">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={value || ''} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger>
          <div className="flex items-center gap-2 flex-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder={placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Select paper specification...</SelectItem>
          {papers.map((paper) => (
            <SelectItem key={paper.id} value={paper.id}>
              {formatPaperSpec(paper)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Display selected specification details */}
      {selectedPaper && (
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Selected: GSM {selectedPaper.gsm}, BF {selectedPaper.bf}, {selectedPaper.shade}
          </span>
        </div>
      )}
    </div>
  );
}

// Helper function to format paper specification for display
export const formatPaperSpec = (spec: PaperSpecification): string => {
  return `GSM ${spec.gsm}, BF ${spec.bf}, ${spec.shade}`;
};

// Helper function to get display label for paper
export const getPaperDisplayLabel = (paper: Paper): string => {
  return `BF ${paper.bf} - ${paper.shade}`;
};