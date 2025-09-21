cmake_minimum_required(VERSION 3.31)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

project(bare_dns C)

set(CARES_STATIC ON CACHE BOOL "Build the static c-ares library" FORCE)
set(CARES_STATIC_PIC ON CACHE BOOL "Enable PIC for the static c-ares library" FORCE)
set(CARES_SHARED OFF CACHE BOOL "Build the shared c-ares library" FORCE)
set(CARES_INSTALL OFF CACHE BOOL "Enable c-ares installation scripts" FORCE)
set(CARES_BUILD_TOOLS OFF CACHE BOOL "Build the c-ares utility tools" FORCE)

fetch_package("github:c-ares/c-ares@1.34.4")
fetch_package("github:holepunchto/libintrusive#3903632")

add_bare_module(bare_dns)

target_sources(
  ${bare_dns}
  PRIVATE
    binding.c
)

target_link_libraries(
  ${bare_dns}
  PUBLIC
    intrusive
  PRIVATE
    c-ares::cares
)
