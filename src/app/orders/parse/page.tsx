/**
 * Parse Message Page
 * Allows users to paste a message to be parsed into an order
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, authFetch } from "@/lib/auth";
import Link from "next/link";

interface ParsedData {
  customer_name: string;
  width_inches: number;
  gsm: number;
  bf: number;
  shade: string;
  quantity_rolls: number;
  quantity_tons?: number;
}

export default function ParseMessagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [message, setMessage] = useState("");
  const [parsedMessage, setParsedMessage] = useState<any>(null);
  const [parsedData, setParsedData] = useState<ParsedData>({
    customer_name: "",
    width_inches: 0,
    gsm: 0,
    bf: 0,
    shade: "",
    quantity_rolls: 0,
    quantity_tons: undefined,
  });
  const [messageId, setMessageId] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const user = getCurrentUser();
      if (!user) {
        router.push("/auth/login?redirect=/orders/parse");
      }
    };

    checkAuth();
  }, [router]);

  // Handle message input change
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  // Handle form input changes for parsed data
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    // Convert numeric inputs to numbers
    if (type === "number") {
      setParsedData({
        ...parsedData,
        [name]: value === "" ? "" : Number(value),
      });
    } else {
      setParsedData({
        ...parsedData,
        [name]: value,
      });
    }
  };

  // Parse the message
  const handleParse = async () => {
    if (!message.trim()) {
      setError("Please enter a message to parse");
      return;
    }

    setParseLoading(true);
    setError("");

    try {
      // First, create a parsed message record
      const createResponse = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/messages/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_message: message,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.detail || "Failed to create message");
      }

      const messageData = await createResponse.json();
      setMessageId(messageData.id);

      // Then, parse the message
      // Note: In a real implementation, this would call the GPT parsing endpoint
      // For now, we'll just simulate parsing with some placeholder logic
      
      // This is a placeholder for the actual GPT parsing
      // In the future, this will be replaced with a call to the parsing API
      const parseResponse = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/messages/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_message: message,
        }),
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.detail || "Failed to parse message");
      }

      // For now, let's simulate some basic parsing
      // This will be replaced with the actual parsed data from the API
      const sampleParsedData = simulateParsing(message);
      
      setParsedMessage(messageData);
      setParsedData(sampleParsedData);
      
    } catch (err) {
      console.error("Error parsing message:", err);
      setError(err instanceof Error ? err.message : "Failed to parse message");
    } finally {
      setParseLoading(false);
    }
  };

  // Simulate parsing (this will be replaced with actual GPT parsing)
  const simulateParsing = (text: string): ParsedData => {
    // Very simple parsing logic - just for demonstration
    // In reality, this would be done by the GPT API
    const lowerText = text.toLowerCase();
    
    // Try to extract width
    const widthMatch = lowerText.match(/(\d+)\s*inch/);
    const width = widthMatch ? parseInt(widthMatch[1]) : 0;
    
    // Try to extract GSM
    const gsmMatch = lowerText.match(/(\d+)\s*gsm/);
    const gsm = gsmMatch ? parseInt(gsmMatch[1]) : 0;
    
    // Try to extract quantity
    const quantityMatch = lowerText.match(/(\d+)\s*roll/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 0;
    
    // Try to extract customer name
    const customerMatch = lowerText.match(/for\s+([a-z\s]+)/) || lowerText.match(/customer[:\s]+([a-z\s]+)/);
    const customer = customerMatch ? customerMatch[1].trim() : "Unknown Customer";
    
    return {
      customer_name: customer,
      width_inches: width,
      gsm: gsm,
      bf: 80, // Default value
      shade: "White", // Default value
      quantity_rolls: quantity,
      quantity_tons: undefined,
    };
  };

  // Calculate tonnage from rolls (1 inch roll = 13 kg)
  const calculateTonnage = () => {
    if (parsedData.width_inches && parsedData.quantity_rolls) {
      // Formula: width_inches * quantity_rolls * 13 kg / 1000 (to convert to tons)
      const tons = (parsedData.width_inches * parsedData.quantity_rolls * 13) / 1000;
      setParsedData({
        ...parsedData,
        quantity_tons: parseFloat(tons.toFixed(2)),
      });
    }
  };

  // Create order from parsed data
  const handleCreateOrder = async () => {
    if (!messageId) {
      setError("No message ID available");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate form data
      if (!parsedData.customer_name) {
        throw new Error("Customer name is required");
      }
      if (!parsedData.width_inches || parsedData.width_inches <= 0) {
        throw new Error("Width must be greater than 0");
      }
      if (!parsedData.gsm || parsedData.gsm <= 0) {
        throw new Error("GSM must be greater than 0");
      }
      if (!parsedData.bf || parsedData.bf <= 0) {
        throw new Error("BF must be greater than 0");
      }
      if (!parsedData.shade) {
        throw new Error("Shade is required");
      }
      if (!parsedData.quantity_rolls || parsedData.quantity_rolls <= 0) {
        throw new Error("Quantity of rolls must be greater than 0");
      }

      // Create order from parsed message
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/orders/from-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message_id: messageId,
          order_data: parsedData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create order");
      }

      const data = await response.json();
      setSuccess("Order created successfully!");
      
      // Reset form after a short delay
      setTimeout(() => {
        router.push(`/orders/${data.id}`);
      }, 1500);
    } catch (err) {
      console.error("Error creating order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create Order from Message</h1>
        <Link
          href="/orders"
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back to Orders
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Paste Message</h2>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message">
              Message Text
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="message"
              name="message"
              rows={6}
              placeholder="Paste the message text here..."
              value={message}
              onChange={handleMessageChange}
              disabled={parseLoading || parsedMessage !== null}
            ></textarea>
          </div>
          <div className="flex justify-end">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={handleParse}
              disabled={parseLoading || parsedMessage !== null}
            >
              {parseLoading ? "Parsing..." : "Parse Message"}
            </button>
          </div>
        </div>

        {parsedMessage && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Parsed Order Details</h2>
              <p className="text-sm text-gray-600 mb-4">
                Review and edit the parsed information below before creating the order.
              </p>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Customer Information</h3>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customer_name">
                    Customer Name *
                  </label>
                  <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id="customer_name"
                    name="customer_name"
                    type="text"
                    value={parsedData.customer_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Roll Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="width_inches">
                      Width (inches) *
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="width_inches"
                      name="width_inches"
                      type="number"
                      min="1"
                      max="200"
                      value={parsedData.width_inches || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gsm">
                      GSM (Grams per Square Meter) *
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="gsm"
                      name="gsm"
                      type="number"
                      min="1"
                      max="1000"
                      value={parsedData.gsm || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bf">
                      BF (Brightness Factor) *
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="bf"
                      name="bf"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={parsedData.bf || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="shade">
                      Shade *
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="shade"
                      name="shade"
                      type="text"
                      value={parsedData.shade}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Quantity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_rolls">
                      Number of Rolls *
                    </label>
                    <input
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="quantity_rolls"
                      name="quantity_rolls"
                      type="number"
                      min="1"
                      value={parsedData.quantity_rolls || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity_tons">
                      Weight in Tons (Optional)
                    </label>
                    <div className="flex">
                      <input
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        id="quantity_tons"
                        name="quantity_tons"
                        type="number"
                        step="0.01"
                        min="0"
                        value={parsedData.quantity_tons || ""}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        onClick={calculateTonnage}
                      >
                        Calculate
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Click Calculate to estimate tonnage based on roll dimensions (1 inch roll = 13 kg)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Order"}
                </button>
                <button
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  type="button"
                  onClick={() => {
                    setParsedMessage(null);
                    setMessageId(null);
                    setMessage("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}