'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Chat } from '@/lib/types'
import { 
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu 
} from '@/components/ui/sidebar'
import { ChatHistorySkeleton } from './chat-history-skeleton'
import { ChatMenuItem } from './chat-menu-item'
import { ClearHistoryAction } from './clear-history-action'
import { getCurrentUserId } from '@/lib/auth/get-current-user'

interface ChatPageResponse {
  chats: Chat[]
  nextOffset: number | null
}

export function ChatHistoryClient() {
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [isPending, start] = useTransition()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // 从本地存储获取历史记录
  const getLocalChats = (): Chat[] => {
    try {
      const chats = localStorage.getItem('morphic:chats')
      return chats ? JSON.parse(chats) : []
    } catch (error) {
      console.error('Error reading local chats:', error)
      return []
    }
  }
  
  // 保存到本地存储
  const saveLocalChats = (chats: Chat[]) => {
    try {
      // 限制只保存最近的20条
      const limitedChats = chats.slice(0, 20)
      localStorage.setItem('morphic:chats', JSON.stringify(limitedChats))
    } catch (error) {
      console.error('Error saving local chats:', error)
    }
  }

  const fetchMoreChats = useCallback(async () => {
    if (isPending || nextOffset === null) return
    
    try {
      const userId = await getCurrentUserId()
      
      // 未登录用户：直接使用本地存储
      if (userId === 'anonymous') {
        const localChats = getLocalChats()
        setChats(localChats)
        setNextOffset(null)
        return
      }
      
      // 已登录用户：使用API获取
      setIsLoading(true)
      const res = await fetch(`/api/chats?offset=${nextOffset}`)
      
      if (!res.ok) {
        throw new Error('Failed to fetch chats')
      }
      
      const data: ChatPageResponse = await res.json()
      setChats(prev => [...prev, ...data.chats])
      setNextOffset(data.nextOffset)
    } catch (error) {
      console.error('Error fetching chats:', error)
      toast.error('Failed to load chat history')
    } finally {
      setIsLoading(false)
    }
  }, [nextOffset, isPending])

  // 初始加载
  useEffect(() => {
    const loadInitialChats = async () => {
      const userId = await getCurrentUserId()
      
      // 未登录用户：直接从本地存储加载
      if (userId === 'anonymous') {
        setChats(getLocalChats())
        setNextOffset(null)
        setIsLoading(false)
        return
      }
      
      // 已登录用户：从API加载
      try {
        setIsLoading(true)
        const res = await fetch('/api/chats?offset=0')
        
        if (res.ok) {
          const data: ChatPageResponse = await res.json()
          setChats(data.chats)
          setNextOffset(data.nextOffset)
        }
      } catch (error) {
        console.error('Error loading initial chats:', error)
        toast.error('Failed to load chat history')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadInitialChats()
  }, [])

  // 监听历史记录更新事件
  useEffect(() => {
    const handleHistoryUpdate = () => {
      const loadChats = async () => {
        const userId = await getCurrentUserId()
        
        if (userId === 'anonymous') {
          setChats(getLocalChats())
        } else {
          try {
            const res = await fetch('/api/chats?offset=0')
            if (res.ok) {
              const data: ChatPageResponse = await res.json()
              setChats(data.chats)
              setNextOffset(data.nextOffset)
            }
          } catch (error) {
            console.error('Error reloading chats:', error)
          }
        }
      }
      
      loadChats()
    }
    
    window.addEventListener('chat-history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('chat-history-updated', handleHistoryUpdate)
  }, [])

  // 无限滚动
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoading && !isPending) {
          start(fetchMoreChats)
        }
      },
      { threshold: 1 }
    )

    const observerRefValue = loadMoreRef.current
    if (observerRefValue) {
      observer.observe(observerRefValue)
    }

    return () => {
      if (observerRefValue) {
        observer.unobserve(observerRefValue)
      }
    }
  }, [fetchMoreChats, nextOffset, isLoading, isPending])

  const isHistoryEmpty = !isLoading && !chats.length && nextOffset === null

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={isHistoryEmpty} />
        </div>
      </SidebarGroup>
      <div className="flex-1 overflow-y-auto mb-2 relative">
        {isHistoryEmpty && !isPending ? (
          <div className="px-2 text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        ) : (
          <SidebarMenu>
            {chats.map((chat: Chat) => chat && <ChatMenuItem key={chat.id} chat={chat} />)}
          </SidebarMenu>
        )}
        <div ref={loadMoreRef} style={{ height: '1px' }} />
        {(isLoading || isPending) && (
          <div className="py-2">
            <ChatHistorySkeleton />
          </div>
        )}
      </div>
    </div>
  )
}