/**
 * Component Tests
 * Tests for React components
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import LoginPage from "@/app/login/page"
import { ErrorBoundary } from "@/components/error-boundary"
import { Pagination } from "@/components/ui/pagination"
import jest from "jest" // Import jest to declare it

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

// Mock toast hook
jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}))

// Mock auth functions
jest.mock("@/lib/auth", () => ({
  signIn: jest.fn(),
}))

describe("Component Tests", () => {
  const mockPush = jest.fn()
  const mockToast = jest.fn()

  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    ;(useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    })
    jest.clearAllMocks()
  })

  describe("Login Page", () => {
    test("should render login form correctly", () => {
      render(<LoginPage />)

      expect(screen.getByText("تسجيل الدخول")).toBeInTheDocument()
      expect(screen.getByText("نظام إدارة المخزون - ITMCO")).toBeInTheDocument()
      expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument()
      expect(screen.getByLabelText("كلمة المرور")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeInTheDocument()
    })

    test("should show validation errors for empty fields", async () => {
      render(<LoginPage />)

      const submitButton = screen.getByRole("button", { name: "تسجيل الدخول" })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText("البريد الإلكتروني غير صالح")).toBeInTheDocument()
        expect(screen.getByText("كلمة المرور مطلوبة")).toBeInTheDocument()
      })
    })

    test("should toggle password visibility", () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText("كلمة المرور")
      const toggleButton = screen.getByRole("button", { name: "" }) // Eye icon button

      expect(passwordInput).toHaveAttribute("type", "password")

      fireEvent.click(toggleButton)
      expect(passwordInput).toHaveAttribute("type", "text")

      fireEvent.click(toggleButton)
      expect(passwordInput).toHaveAttribute("type", "password")
    })

    test("should show demo accounts information", () => {
      render(<LoginPage />)

      expect(screen.getByText("حسابات تجريبية:")).toBeInTheDocument()
      expect(screen.getByText("مدير: itmcoadmin@gmail.com / itmcoadmin@12")).toBeInTheDocument()
      expect(screen.getByText("مخزون: inventory@itmco.com / inventory@itmco")).toBeInTheDocument()
      expect(screen.getByText("مهندس: engineer@itmco.com / engineer@itmco")).toBeInTheDocument()
    })
  })

  describe("Error Boundary", () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error("Test error")
      }
      return <div>No error</div>
    }

    test("should render children when no error", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      )

      expect(screen.getByText("No error")).toBeInTheDocument()
    })

    test("should render error fallback when error occurs", () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      )

      expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument()
      expect(screen.getByText("عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    test("should reset error when retry button is clicked", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      )

      expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument()

      const retryButton = screen.getByRole("button", { name: "إعادة المحاولة" })
      fireEvent.click(retryButton)

      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      )

      expect(screen.getByText("No error")).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe("Pagination Component", () => {
    const defaultProps = {
      currentPage: 1,
      totalPages: 10,
      onPageChange: jest.fn(),
    }

    test("should render pagination correctly", () => {
      render(<Pagination {...defaultProps} />)

      expect(screen.getByText("السابق")).toBeInTheDocument()
      expect(screen.getByText("التالي")).toBeInTheDocument()
      expect(screen.getByText("1")).toBeInTheDocument()
    })

    test("should disable previous button on first page", () => {
      render(<Pagination {...defaultProps} currentPage={1} />)

      const prevButton = screen.getByText("السابق").closest("button")
      expect(prevButton).toBeDisabled()
    })

    test("should disable next button on last page", () => {
      render(<Pagination {...defaultProps} currentPage={10} totalPages={10} />)

      const nextButton = screen.getByText("التالي").closest("button")
      expect(nextButton).toBeDisabled()
    })

    test("should call onPageChange when page is clicked", () => {
      const onPageChange = jest.fn()
      render(<Pagination {...defaultProps} onPageChange={onPageChange} />)

      const pageButton = screen.getByText("2")
      fireEvent.click(pageButton)

      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    test("should show ellipsis for large page counts", () => {
      render(<Pagination {...defaultProps} currentPage={5} totalPages={20} />)

      // Should show ellipsis
      const ellipsisButtons = screen.getAllByRole("button", { name: "" })
      expect(ellipsisButtons.length).toBeGreaterThan(0)
    })
  })
})
