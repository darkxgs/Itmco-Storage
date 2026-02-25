"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Plus, 
  Calendar, 
  Clock, 
  Package, 
  TrendingUp, 
  History,
  Loader2,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  getProductStockHistory, 
  createStockEntry, 
  getStockEntriesSummary,
  formatDateOnly,
  formatDateTime,
  formatTimeOnly
} from "@/lib/database"

interface StockEntriesDialogProps {
  isOpen: boolean
  onClose: () => void
  product: {
    id: number
    name: string
    item_code?: string
    stock: number
  } | null
  user: {
    id: string
    name: string
  }
  onStockUpdated: () => void
}

export function StockEntriesDialog({ 
  isOpen, 
  onClose, 
  product, 
  user,
  onStockUpdated 
}: StockEntriesDialogProps) {
  const [stockEntries, setStockEntries] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEntry, setNewEntry] = useState({
    quantity: "",
    notes: ""
  })
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && product) {
      loadStockHistory()
      loadSummary()
    }
  }, [isOpen, product])

  const loadStockHistory = async () => {
    if (!product) return
    
    setLoading(true)
    try {
      const history = await getProductStockHistory(product.id)
      setStockEntries(history)
    } catch (error: any) {
      toast({
        title: "خطأ في التحميل",
        description: error.message || "فشل في تحميل تاريخ المخزون",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    if (!product) return
    
    try {
      const summaryData = await getStockEntriesSummary(product.id)
      setSummary(summaryData)
    } catch (error: any) {
      console.error("Error loading summary:", error)
    }
  }

  const handleAddStock = async () => {
    if (!product || !newEntry.quantity) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى إدخال الكمية المطلوبة",
        variant: "destructive",
      })
      return
    }

    const quantity = parseInt(newEntry.quantity)
    if (quantity <= 0) {
      toast({
        title: "كمية غير صحيحة",
        description: "يجب أن تكون الكمية أكبر من صفر",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await createStockEntry({
        productId: product.id,
        quantityAdded: quantity,
        notes: newEntry.notes || undefined,
        userId: user.id,
        userName: user.name
      })

      // Reset form
      setNewEntry({ quantity: "", notes: "" })
      setShowAddForm(false)

      // Reload data
      await Promise.all([loadStockHistory(), loadSummary()])
      
      // Notify parent component
      onStockUpdated()

      toast({
        title: "تمت الإضافة بنجاح",
        description: `تم إضافة ${quantity} قطعة إلى المخزون`,
      })
    } catch (error: any) {
      toast({
        title: "فشل في إضافة الكمية",
        description: error.message || "حدث خطأ أثناء إضافة الكمية",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setShowAddForm(false)
    setNewEntry({ quantity: "", notes: "" })
    onClose()
  }

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            تاريخ إدخال الكميات - {product.name}
          </DialogTitle>
          {product.item_code && (
            <p className="text-slate-400 text-sm">كود الصنف: {product.item_code}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    المخزون الحالي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{product.stock}</div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    إجمالي الكميات المضافة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">{summary.totalQuantityAdded}</div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    عدد مرات الإدخال
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">{summary.entriesCount}</div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    متوسط الكمية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-400">{summary.averagePerEntry}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Add Stock Form */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  إضافة كمية جديدة
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {showAddForm ? "إلغاء" : "إضافة"}
                </Button>
              </CardTitle>
            </CardHeader>
            {showAddForm && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity" className="text-slate-300">
                      الكمية المضافة *
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newEntry.quantity}
                      onChange={(e) => setNewEntry({ ...newEntry, quantity: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="أدخل الكمية"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-slate-300">
                      ملاحظات (اختياري)
                    </Label>
                    <Textarea
                      id="notes"
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="ملاحظات حول عملية الإدخال"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddStock}
                    disabled={submitting || !newEntry.quantity}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        جاري الإضافة...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        إضافة الكمية
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Stock Entries History */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                تاريخ عمليات الإدخال
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="mr-2 text-slate-300">جاري التحميل...</span>
                </div>
              ) : stockEntries.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <AlertCircle className="w-6 h-6 ml-2" />
                  لا توجد عمليات إدخال مسجلة لهذا المنتج
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">التاريخ الميلادي</TableHead>
                        <TableHead className="text-slate-300">الوقت</TableHead>
                        <TableHead className="text-slate-300">الكمية المضافة</TableHead>
                        <TableHead className="text-slate-300">المخزون السابق</TableHead>
                        <TableHead className="text-slate-300">المخزون الجديد</TableHead>
                        <TableHead className="text-slate-300">أدخل بواسطة</TableHead>
                        <TableHead className="text-slate-300">ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockEntries.map((entry) => (
                        <TableRow key={entry.id} className="border-slate-700">
                          <TableCell className="text-white">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              {formatDateOnly(entry.entry_date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-green-400" />
                              {formatTimeOnly(entry.entry_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-green-600/20 text-green-400 border-green-600/30">
                              +{entry.quantity_added}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{entry.previous_stock}</TableCell>
                          <TableCell className="text-white font-medium">{entry.new_stock}</TableCell>
                          <TableCell className="text-slate-300">{entry.entered_by}</TableCell>
                          <TableCell className="text-slate-400 max-w-[200px] truncate">
                            {entry.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}