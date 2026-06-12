/**
 * @file include/bits/stdc++.h
 * @brief Portable drop-in for the GCC "include everything" convenience header.
 *
 * The `#include <bits/stdc++.h>` idiom is ubiquitous in competitive
 * programming, but it is a libstdc++ (GCC) implementation detail. Apple clang
 * with libc++ — the default toolchain on macOS — ships no such header, so the
 * idiom fails to compile there even though the toolkit advertises
 * "Cross-platform (Linux / macOS / WSL)" support.
 *
 * `cf` and the Makefile both compile with `-I include`, so dropping this shim
 * here makes the idiom resolve to a portable aggregate that pulls in the whole
 * Standard Library on any conforming C++17-or-later toolchain. On GCC it simply
 * shadows the native header with an equivalent set of includes.
 *
 * Headers that may be absent depending on the standard library / language mode
 * are gated behind `__has_include` so this file never fails to compile, no
 * matter how old or new the toolchain is.
 */

#ifndef CF_BITS_STDCXX_H
#define CF_BITS_STDCXX_H

// ==================== C compatibility headers ====================
#include <cassert>
#include <cctype>
#include <cerrno>
#include <cfenv>
#include <cfloat>
#include <cinttypes>
#include <climits>
#include <clocale>
#include <cmath>
#include <csetjmp>
#include <csignal>
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <cwchar>
#include <cwctype>
#if __has_include(<cuchar>)
#include <cuchar>
#endif

// ==================== Containers ====================
#include <array>
#include <bitset>
#include <deque>
#include <forward_list>
#include <list>
#include <map>
#include <queue>
#include <set>
#include <stack>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// ==================== Strings & text ====================
#include <string>
#include <string_view>
#include <regex>
#if __has_include(<charconv>)
#include <charconv>
#endif

// ==================== Algorithms, iterators, ranges, numerics ====================
#include <algorithm>
#include <iterator>
#include <numeric>
#if __has_include(<ranges>)
#include <ranges>
#endif

// ==================== Numerics ====================
#include <complex>
#include <random>
#include <ratio>
#include <valarray>
#if __has_include(<bit>)
#include <bit>
#endif
#if __has_include(<numbers>)
#include <numbers>
#endif

// ==================== I/O streams ====================
#include <fstream>
#include <iomanip>
#include <ios>
#include <iosfwd>
#include <iostream>
#include <istream>
#include <ostream>
#include <sstream>
#include <streambuf>

// ==================== General utilities ====================
#include <chrono>
#include <exception>
#include <functional>
#include <initializer_list>
#include <limits>
#include <locale>
#include <memory>
#include <new>
#include <stdexcept>
#include <system_error>
#include <tuple>
#include <type_traits>
#include <typeindex>
#include <typeinfo>
#include <utility>
#include <version>
#if __has_include(<any>)
#include <any>
#endif
#if __has_include(<optional>)
#include <optional>
#endif
#if __has_include(<variant>)
#include <variant>
#endif
#if __has_include(<memory_resource>)
#include <memory_resource>
#endif
#if __has_include(<scoped_allocator>)
#include <scoped_allocator>
#endif
#if __has_include(<compare>)
#include <compare>
#endif
#if __has_include(<concepts>)
#include <concepts>
#endif
#if __has_include(<coroutine>)
#include <coroutine>
#endif
#if __has_include(<source_location>)
#include <source_location>
#endif
#if __has_include(<filesystem>)
#include <filesystem>
#endif
#if __has_include(<span>)
#include <span>
#endif
#if __has_include(<format>)
#include <format>
#endif
#if __has_include(<expected>)
#include <expected>
#endif

// ==================== Threading ====================
#include <atomic>
#if __has_include(<barrier>)
#include <barrier>
#endif
#include <condition_variable>
#include <future>
#if __has_include(<latch>)
#include <latch>
#endif
#include <mutex>
#if __has_include(<semaphore>)
#include <semaphore>
#endif
#include <shared_mutex>
#if __has_include(<stop_token>)
#include <stop_token>
#endif
#include <thread>

#endif // CF_BITS_STDCXX_H
