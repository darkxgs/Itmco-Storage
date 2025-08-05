# PowerShell script to fix all remaining pages

$pages = @(
    "app/search/page.tsx",
    "app/settings/page.tsx", 
    "app/issuance/page.tsx",
    "app/backup/page.tsx"
)

foreach ($page in $pages) {
    Write-Host "Fixing $page..."
    
    # Read file content
    $content = Get-Content $page -Raw
    
    # Replace imports
    $content = $content -replace 'import { useRouter } from "next/navigation"', ''
    $content = $content -replace 'import { useToast } from "@/hooks/use-toast"', 'import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"'
    
    # Replace component declaration
    $content = $content -replace 'const \[user, setUser\] = useState<any>\(null\)', ''
    $content = $content -replace 'const router = useRouter\(\)', ''
    $content = $content -replace 'const { toast } = useToast\(\)', 'const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()'
    
    # Write back to file
    Set-Content $page $content
    
    Write-Host "Fixed $page ✓"
}

Write-Host "All pages fixed!"