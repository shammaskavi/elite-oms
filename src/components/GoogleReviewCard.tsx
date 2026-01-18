import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const GOOGLE_REVIEW_URL =
    "https://search.google.com/local/writereview?placeid=ChIJbxivWplOXjkRYu5OanpLoeY";

export function GoogleReviewCard() {
    return (
        <div className="border rounded-lg p-5 bg-gradient-to-br from-pink-50 to-white text-center space-y-3">
            <div className="flex justify-center text-yellow-500">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18} fill="currentColor" />
                ))}
            </div>

            <h3 className="font-semibold text-lg">
                Loved shopping with Saree Palace Elite?
            </h3>

            <p className="text-sm text-muted-foreground">
                Your review helps us grow and serve you better ❤️
            </p>

            <Button
                className="mt-2"
                onClick={() => window.open(GOOGLE_REVIEW_URL, "_blank")}
            >
                Leave a Review
            </Button>
        </div>
    );
}