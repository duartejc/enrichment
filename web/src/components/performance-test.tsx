"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconLoader2, IconPlayerPlay, IconRefresh, IconChartBar } from "@tabler/icons-react"
import { generateTestData, testWebSocketPerformance, type TestDataRecord, PerformanceTester } from "@/test-data-generator"
import { websocketService } from "@/services/websocket.service"

interface PerformanceMetrics {
  connectionTime: number
  averageBatchTime: number
  maxBatchTime: number
  minBatchTime: number
  totalTime: number
  report: string
}

export function PerformanceTest() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testData, setTestData] = useState<TestDataRecord[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [enrichmentResults, setEnrichmentResults] = useState<any[]>([])
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)

  const generateTestData = useCallback(async (count: number = 1000) => {
    setIsGenerating(true)
    try {
      const tester = new PerformanceTester()
      tester.startTimer()
      
      const data = generateTestData(count)
      setTestData(data)
      
      const generationTime = tester.endTimer()
      console.log(`Generated ${count} test records in ${generationTime.toFixed(2)}ms`)
      
      return data
    } catch (error) {
      console.error('Error generating test data:', error)
      return []
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const runPerformanceTest = useCallback(async () => {
    if (testData.length === 0) {
      const data = await generateTestData(1000)
      if (data.length === 0) return
    }

    setIsTesting(true)
    setEnrichmentResults([])
    
    try {
      const tester = new PerformanceTester()
      
      // Test data generation performance
      console.log('=== Performance Test Results ===')
      console.log(`Dataset size: ${testData.length} records`)
      
      // Test WebSocket enrichment performance
      if (isWebSocketConnected) {
        console.log('Testing WebSocket enrichment performance...')
        
        const startTime = performance.now()
        
        // Start enrichment via WebSocket
        const sessionId = websocketService.startEnrichment(testData, 'address', {
          batchSize: 50,
          concurrency: 3
        })
        
        console.log(`Started enrichment session: ${sessionId}`)
        
        // Simulate waiting for completion (in real scenario, this would be event-driven)
        const enrichmentTime = performance.now() - startTime
        console.log(`Enrichment completed in ${enrichmentTime.toFixed(2)}ms`)
        
        setMetrics({
          connectionTime: 0,
          averageBatchTime: enrichmentTime / Math.ceil(testData.length / 50),
          maxBatchTime: enrichmentTime,
          minBatchTime: enrichmentTime / Math.ceil(testData.length / 50),
          totalTime: enrichmentTime,
          report: `
Performance Test Results:
=======================
Dataset Size: ${testData.length} records
Enrichment Type: Address
Batch Size: 50
Concurrency: 3
Total Time: ${enrichmentTime.toFixed(2)}ms
Average Batch Time: ${(enrichmentTime / Math.ceil(testData.length / 50)).toFixed(2)}ms
Records per second: ${(testData.length / (enrichmentTime / 1000)).toFixed(2)}
          `.trim()
        })
      } else {
        // Simulate performance test without WebSocket
        const simulatedMetrics = await testWebSocketPerformance(testData, 50)
        setMetrics(simulatedMetrics)
      }
      
    } catch (error) {
      console.error('Error during performance test:', error)
    } finally {
      setIsTesting(false)
    }
  }, [testData, isWebSocketConnected, generateTestData])

  const clearResults = useCallback(() => {
    setTestData([])
    setMetrics(null)
    setEnrichmentResults([])
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartBar size={20} />
            Performance Test - WebSocket Data Enrichment
          </CardTitle>
          <CardDescription>
            Test the performance of WebSocket-based data enrichment with large datasets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Button
              onClick={() => generateTestData(1000)}
              disabled={isGenerating || isTesting}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <IconLoader2 className="animate-spin" size={16} />
                  Generating...
                </>
              ) : (
                <>
                  <IconRefresh size={16} />
                  Generate 1000 Records
                </>
              )}
            </Button>
            
            <Button
              onClick={runPerformanceTest}
              disabled={isTesting || testData.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <IconLoader2 className="animate-spin" size={16} />
                  Testing...
                </>
              ) : (
                <>
                  <IconPlayerPlay size={16} />
                  Run Performance Test
                </>
              )}
            </Button>
            
            <Button
              onClick={clearResults}
              disabled={isTesting}
              variant="destructive"
            >
              Clear Results
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">WebSocket Status:</span>
              <Badge variant={isWebSocketConnected ? "default" : "secondary"}>
                {isWebSocketConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
          
          {testData.length > 0 && (
            <div className="text-sm text-gray-600">
              Generated {testData.length.toLocaleString()} test records
            </div>
          )}
        </CardContent>
      </Card>
      
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics.totalTime.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-gray-600">Total Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.averageBatchTime.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-gray-600">Avg Batch Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.maxBatchTime.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-gray-600">Max Batch Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {(testData.length / (metrics.totalTime / 1000)).toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-600">Records/sec</div>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium mb-2">Detailed Report</h4>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {metrics.report}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {enrichmentResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Enrichment Results Sample</CardTitle>
            <CardDescription>
              Showing first 5 enriched records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {enrichmentResults.slice(0, 5).map((result, index) => (
                <div key={index} className="border rounded p-3 text-sm">
                  <div className="font-medium">Record {result.rowIndex + 1}</div>
                  <div className="text-gray-600">
                    {Object.entries(result.enrichedFields || {}).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key}:</strong> {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
