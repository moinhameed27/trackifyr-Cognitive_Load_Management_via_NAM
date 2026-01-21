/**
 * @fileoverview Authentication context provider - manages user authentication state
 * using localStorage for persistence.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'user'

const getStoredUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  } catch (error) {
    console.error('Error reading user from localStorage:', error)
    return null
  }
}

const setStoredUser = (userData) => {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    return true
  } catch (error) {
    console.error('Error saving user to localStorage:', error)
    return false
  }
}

const removeStoredUser = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error removing user from localStorage:', error)
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
      setIsAuthenticated(true)
    }
  }, [])

  const signup = (userData) => {
    if (!userData || !userData.email) {
      return { success: false, error: 'Invalid user data provided' }
    }
    
    const saved = setStoredUser(userData)
    if (saved) {
      setUser(userData)
      setIsAuthenticated(true)
      return { success: true }
    }
    return { success: false, error: 'Failed to save user data' }
  }

  const signin = (email, password) => {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' }
    }

    const storedUser = getStoredUser()
    if (storedUser && storedUser.email === email.toLowerCase().trim()) {
      setUser(storedUser)
      setIsAuthenticated(true)
      return { success: true }
    }
    return { success: false, error: 'Invalid credentials' }
  }

  const signout = () => {
    removeStoredUser()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signup, signin, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}



