import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronRight, ShoppingBag } from "lucide-react";

const SHOPIFY_DOMAIN = "sareepalaceelite.in";
const STOREFRONT_TOKEN = "5782b53e38e91b16058157fa62f363af";

const fetchLatestProducts = async () => {
    const query = `
    {
      products(first: 4, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            handle
            images(first: 1) {
              edges { node { url } }
            }
            priceRange {
              minVariantPrice { amount }
            }
          }
        }
      }
    }
  `;

    const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();
    return data?.products?.edges || [];
};

export function ShopifyWidget() {
    const { data: products, isLoading } = useQuery({
        queryKey: ["shopify-products"],
        queryFn: fetchLatestProducts,
    });

    if (isLoading || !products || products.length === 0) return null;

    return (
        <div className="mt-12 py-8 border-t border-dashed">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold tracking-tight text-gray-900">New Arrivals</h3>
                    <p className="text-sm text-muted-foreground">Handpicked styles for you</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                    onClick={() => window.open(`https://${SHOPIFY_DOMAIN}`, '_blank')}
                >
                    Explore More <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </div>

            {/* make the grid one col on mobile view */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-8">
                {products.map(({ node }: any) => (
                    <div
                        key={node.id}
                        className="group relative cursor-pointer"
                        onClick={() => window.open(`https://${SHOPIFY_DOMAIN}/products/${node.handle}`, '_blank')}
                    >
                        {/* Image Container with Saree-appropriate Aspect Ratio */}
                        <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100 relative">
                            <img
                                src={node.images.edges[0]?.node.url}
                                alt={node.title}
                                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
                            />
                            {/* Overlay Bag Icon on Hover */}
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-white/90 p-3 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    <ShoppingBag className="h-5 w-5 text-pink-600" />
                                </div>
                            </div>
                        </div>

                        {/* Product Info */}
                        <div className="mt-3 space-y-1 px-1">
                            <h4 className="text-sm font-medium text-gray-700 line-clamp-1 group-hover:text-pink-600 transition-colors">
                                {node.title}
                            </h4>
                            <div className="flex items-center justify-between">
                                <p className="text-base font-bold text-gray-900">
                                    ₹{Number(node.priceRange.minVariantPrice.amount).toLocaleString("en-IN")}
                                </p>
                                <span className="text-[10px] uppercase tracking-widest text-pink-500 font-semibold bg-pink-50 px-2 py-0.5 rounded">
                                    New
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {/* <p className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                Exclusively available at Saree Palace Elite
            </p> */}
        </div>
    );
}