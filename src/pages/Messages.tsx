import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, MessageSquare, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { format } from "date-fns";
import type { Message, Customer } from "@/types/database";

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMessages = async () => {
    const { data } = await api.from("messages").select("*, customer:customers(name)").order("created_at", { ascending: false }).limit(500);
    setMessages((data as unknown as Message[]) ?? []);
  };

  const fetchCustomers = async () => {
    const { data } = await api.from("customers").select("*").order("name");
    setCustomers((data as unknown as Customer[]) ?? []);
  };

  useEffect(() => { fetchMessages(); fetchCustomers(); }, []);

  useEffect(() => {
    const channel = api.channel("messages-realtime").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchMessages()).subscribe();
    return () => { api.removeChannel(channel); };
  }, []);

  const handleSend = async () => {
    if (!selectedCustomerId || !content.trim()) return;
    const { error } = await api.from("messages").insert({ customer_id: selectedCustomerId, content: content.trim(), direction });
    if (error) { toast.error(error.message); return; }
    toast.success("Message logged");
    setContent("");
    fetchMessages();
  };

  // Group messages by customer for sidebar
  const customerMessageCounts = messages.reduce<Record<string, { name: string; count: number; lastMessage: string }>>((acc, m) => {
    const name = (m.customer as any)?.name ?? "Unknown";
    if (!acc[m.customer_id]) {
      acc[m.customer_id] = { name, count: 0, lastMessage: m.created_at };
    }
    acc[m.customer_id].count++;
    return acc;
  }, {});

  const customerList = Object.entries(customerMessageCounts)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.lastMessage.localeCompare(a.lastMessage));

  const filteredCustomerList = customerList.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Messages for selected customer, sorted oldest first for chat view
  const selectedMessages = selectedCustomerId
    ? messages.filter(m => m.customer_id === selectedCustomerId).reverse()
    : [];

  const selectedCustomerName = selectedCustomerId
    ? customerMessageCounts[selectedCustomerId]?.name ?? customers.find(c => c.id === selectedCustomerId)?.name ?? "Customer"
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Customer conversations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Customer sidebar */}
        <Card className="md:col-span-1 flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredCustomerList.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">No conversations yet</p>
            )}
            {filteredCustomerList.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className={`w-full text-left p-3 border-b transition-colors hover:bg-accent/50 ${selectedCustomerId === c.id ? "bg-accent/30" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{c.count}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.lastMessage), "dd MMM HH:mm")}</p>
              </button>
            ))}
            {/* Show customers with no messages */}
            {customers.filter(c => !customerMessageCounts[c.id]).map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className={`w-full text-left p-3 border-b transition-colors hover:bg-accent/50 ${selectedCustomerId === c.id ? "bg-accent/30" : ""}`}
              >
                <p className="font-medium text-sm truncate text-muted-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">No messages</p>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Conversation pane */}
        <Card className="md:col-span-2 flex flex-col">
          {!selectedCustomerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>Select a customer to view messages</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b">
                <h3 className="font-semibold">{selectedCustomerName}</h3>
                <p className="text-xs text-muted-foreground">{selectedMessages.length} messages</p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {selectedMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg p-3 ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="text-sm">{m.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {m.direction === "inbound" ? <ArrowDownLeft className="h-3 w-3 opacity-60" /> : <ArrowUpRight className="h-3 w-3 opacity-60" />}
                          <span className="text-xs opacity-60">{format(new Date(m.created_at), "dd MMM HH:mm")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedMessages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No messages with this customer yet</p>
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t space-y-2">
                <div className="flex gap-2">
                  <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Type a message..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={1}
                    className="flex-1 min-h-[40px] resize-none"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <Button onClick={handleSend} disabled={!content.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Messages;
