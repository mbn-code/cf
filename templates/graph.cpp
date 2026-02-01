/**
 * @file graph.cpp
 * @brief Graph algorithms template for competitive programming
 * @description Common graph algorithms: BFS, DFS, shortest path, etc.
 */

#include <iostream>
#include <vector>
#include <queue>
#include <algorithm>
#include <climits>

using namespace std;

#define ll long long
#define all(x) (x).begin(), (x).end()
#define vi vector<int>
#define vvi vector<vector<int>>

// ==================== GRAPH STRUCTURES ====================

/**
 * @struct Graph
 * @brief Adjacency list representation of graph
 */
struct Graph {
    int vertices;
    vvi adj;
    
    Graph(int v) : vertices(v), adj(v) {}
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);  // For undirected graphs
    }
};

// ==================== BFS ====================

/**
 * @brief Breadth-first search
 * @param graph The graph
 * @param start Starting vertex
 * @return Vector of distances from start
 */
vi bfs(const Graph& graph, int start) {
    vi distance(graph.vertices, -1);
    queue<int> q;
    
    q.push(start);
    distance[start] = 0;
    
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        
        for (int v : graph.adj[u]) {
            if (distance[v] == -1) {
                distance[v] = distance[u] + 1;
                q.push(v);
            }
        }
    }
    
    return distance;
}

// ==================== DFS ====================

/**
 * @brief Depth-first search
 * @param graph The graph
 * @param v Current vertex
 * @param visited Visited array
 */
void dfs(const Graph& graph, int v, vi& visited) {
    visited[v] = 1;
    
    for (int u : graph.adj[v]) {
        if (!visited[u]) {
            dfs(graph, u, visited);
        }
    }
}

/**
 * @brief DFS wrapper
 * @param graph The graph
 * @return Number of connected components
 */
int countComponents(const Graph& graph) {
    vi visited(graph.vertices, 0);
    int components = 0;
    
    for (int i = 0; i < graph.vertices; i++) {
        if (!visited[i]) {
            dfs(graph, i, visited);
            components++;
        }
    }
    
    return components;
}

// ==================== EXAMPLE ====================

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // Example: Create a graph and run BFS
    Graph g(6);
    g.addEdge(0, 1);
    g.addEdge(0, 2);
    g.addEdge(1, 3);
    g.addEdge(2, 3);
    g.addEdge(3, 4);
    
    vi dist = bfs(g, 0);
    
    cout << "Distances from vertex 0:" << endl;
    for (int i = 0; i < g.vertices; i++) {
        cout << "To " << i << ": " << dist[i] << endl;
    }
    
    return 0;
}
