import { QueryClient } from '@tanstack/react-query'

// Mỗi khối dữ liệu của từng dịch vụ là 1 query riêng để lỗi SVC-REV/NTF/RPT chỉ ảnh hưởng khối đó (NFR-REL-005).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
