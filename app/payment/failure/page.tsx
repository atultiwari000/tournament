"use client";

/**
 * Payment Failure Page
 * 
 * This page is displayed when payment fails or is cancelled by the user.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentFailurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactionUuid, setTransactionUuid] = useState<string | null>(null);

  useEffect(() => {
    // Try to get transaction UUID from either 'data' parameter or direct parameter
    const encodedData = searchParams.get("data");
    
    if (encodedData) {
      try {
        const decodedString = atob(encodedData);
        const responseData = JSON.parse(decodedString);
        setTransactionUuid(responseData.transaction_uuid);
      } catch (e) {
        console.error("Error decoding eSewa failure response:", e);
      }
    } else {
      // Fallback to direct parameter
      const uuid = searchParams.get("transaction_uuid");
      setTransactionUuid(uuid);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 p-4 rounded-full">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Payment Failed</CardTitle>
          <p className="text-muted-foreground mt-2">
            Your payment could not be processed or was cancelled.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4 text-red-800" />
            <AlertDescription>
              Your booking hold is still active for a limited time. You can try again before it expires.
            </AlertDescription>
          </Alert>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-2">Common reasons for failure:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-1">
              <li>Payment was cancelled by you</li>
              <li>Insufficient balance in eSewa account</li>
              <li>Network connectivity issues</li>
              <li>Session timeout</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {transactionUuid && (
              <Button 
                className="w-full h-12 text-lg"
                onClick={() => router.push(`/payment/${transactionUuid}`)}
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Try Payment Again
              </Button>
            )}
            <Button 
              variant="outline" 
              className="w-full h-12"
              onClick={() => router.push("/venues")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Browse Other Venues
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If you continue to experience issues, please contact our support team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
