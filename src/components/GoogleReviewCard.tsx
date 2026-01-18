import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const GOOGLE_REVIEW_URL =
    "https://www.google.com/search?client=safari&hs=DcBp&sca_esv=a64ff662bc0fc51f&rls=en&sxsrf=ANbL-n5Xovsbkn9OOr-0G3r2s381gaNt6w:1768728075451&si=AL3DRZFIhG6pAqfNLal55wUTwygCG0fClF3UxiOmgw9Hq7nbWYWEJrWfuSNvotMGOLkTGO1I14HlDyyHnpGNI8_Lbsqd8psnqRRxAjJFCUSXI5ta0RfBltfhvDJ6PerNvAdVRBgDUG8p7BOGAAvZqkyLTiowpVvVqg%3D%3D&q=Saree+Palace+Elite+Reviews&sa=X&ved=2ahUKEwi7z5DF4ZSSAxVwR2wGHVlDAmEQ0bkNegQINBAH&biw=1104&bih=630&dpr=2&aic=0&zx=1768728651764&no_sw_cr=1#lrd=0x395e4e995aaf186f:0xe6a14b7a6a4eee62,3,,,,";

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