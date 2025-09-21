cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_type C)

add_bare_module(bare_type)

target_sources(
  ${bare_type}
  PRIVATE
    binding.c
)
