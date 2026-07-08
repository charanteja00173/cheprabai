import React, { useState } from "react";
import { Box, Flex, VStack, IconButton, Tooltip, Text, useBreakpointValue } from "@chakra-ui/react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Video, Radio, Menu, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ThemeSwitcher from "./ThemeSwitcher";

const MotionBox = motion(Box);

const UnifiedWorkspace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const NAV_ITEMS = [
    { path: "/", icon: <MessageSquare size={24} />, label: "Secure Chat" },
    { path: "/call", icon: <Video size={24} />, label: "E2EE Video Call" },
    { path: "/live-stream", icon: <Radio size={24} />, label: "Live Stream" },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <Flex h="100vh" w="100vw" overflow="hidden" bg="var(--chakra-colors-bg)" color="var(--chakra-colors-textPrimary)">
      {/* Mobile Top Nav */}
      {isMobile && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          w="100%"
          h="calc(52px + env(safe-area-inset-top, 0px))"
          pt="env(safe-area-inset-top, 0px)"
          bg="rgba(10, 10, 14, 0.65)"
          backdropFilter="blur(24px)"
          WebkitBackdropFilter="blur(24px)"
          borderBottom="1px solid rgba(255, 255, 255, 0.06)"
          alignItems="center"
          px={4}
          zIndex={20}
          justifyContent="space-between"
          boxShadow="0 4px 20px rgba(0,0,0,0.3)"
        >
          <Flex alignItems="center" gap={2}>
            <IconButton
              icon={<Menu />}
              variant="ghost"
              color="var(--chakra-colors-textPrimary)"
              onClick={toggleSidebar}
              aria-label="Open Menu"
              _hover={{ bg: "rgba(255,255,255,0.06)" }}
              borderRadius="12px"
            />
            <Box color="var(--chakra-colors-brandPrimary)" filter="drop-shadow(0 0 6px var(--chakra-colors-brandGlow))">
              <ShieldCheck size={22} />
            </Box>
            <Text fontWeight="800" fontSize="md" letterSpacing="-0.5px">ChepraBai</Text>
          </Flex>
          <ThemeSwitcher />
        </Flex>
      )}

      {/* Sidebar Backdrop Overlay */}
      {isMobile && isSidebarOpen && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0, 0, 0, 0.55)"
          backdropFilter="blur(4px)"
          WebkitBackdropFilter="blur(4px)"
          zIndex={9}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <MotionBox
        w={{ base: isSidebarOpen ? "260px" : "0px", md: "68px" }}
        h="100%"
        bg="rgba(10, 10, 14, 0.55)"
        backdropFilter="blur(30px)"
        WebkitBackdropFilter="blur(30px)"
        borderRight="1px solid rgba(255, 255, 255, 0.06)"
        boxShadow="4px 0 20px rgba(0,0,0,0.2)"
        display="flex"
        flexDirection="column"
        alignItems="center"
        py={isMobile ? "calc(68px + env(safe-area-inset-top, 0px))" : 6}
        position={{ base: "fixed", md: "relative" }}
        zIndex={10}
        overflow="hidden"
        initial={false}
        animate={{ width: isMobile ? (isSidebarOpen ? "260px" : "0px") : "68px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {!isMobile && (
          <Box mb={8} position="relative" display="flex" alignItems="center" justifyContent="center">
            {/* Pulsing radar rings for premium look */}
            <Box
              position="absolute"
              w="40px"
              h="40px"
              borderRadius="full"
              border="2px solid var(--chakra-colors-brandPrimary)"
              opacity={0.35}
              animation="radar-pulse 2s infinite"
              pointerEvents="none"
            />
            <Box color="var(--chakra-colors-brandPrimary)" zIndex={1} filter="drop-shadow(0 0 8px var(--chakra-colors-brandGlow))">
              <ShieldCheck size={26} />
            </Box>
            <style>{`
              @keyframes radar-pulse {
                0% { transform: scale(0.8); opacity: 0.8; }
                100% { transform: scale(1.6); opacity: 0; }
              }
            `}</style>
          </Box>
        )}

        <VStack spacing={4} w="100%" px={isMobile ? 3 : 0}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={item.path} label={isMobile ? "" : item.label} placement="right" hasArrow>
                <Flex
                  position="relative"
                  w={isMobile ? "100%" : "46px"}
                  h="46px"
                  borderRadius="14px"
                  alignItems="center"
                  justifyContent={isMobile ? "flex-start" : "center"}
                  px={isMobile ? 4 : 0}
                  cursor="pointer"
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  color={isActive ? "white" : "var(--chakra-colors-textSecondary)"}
                  transition="color 0.25s ease, transform 0.2s"
                  _hover={{
                    color: isActive ? "white" : "var(--chakra-colors-textPrimary)",
                    transform: "scale(1.02)"
                  }}
                >
                  {isActive && (
                    <MotionBox
                      layoutId="sidebarActiveBg"
                      position="absolute"
                      inset={0}
                      bg="var(--chakra-colors-brandPrimary)"
                      borderRadius="14px"
                      boxShadow="0 4px 15px var(--chakra-colors-brandGlow)"
                      zIndex={-1}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  
                  {/* Subtle active left dot indicator on desktop */}
                  {isActive && !isMobile && (
                    <Box
                      position="absolute"
                      left="-8px"
                      w="3px"
                      h="14px"
                      bg="var(--chakra-colors-brandPrimary)"
                      borderRadius="full"
                    />
                  )}

                  <Box zIndex={1} display="flex" alignItems="center" justifyContent="center">
                    {item.icon}
                  </Box>
                  
                  {isMobile && (
                    <Text zIndex={1} ml={4} fontWeight={isActive ? "bold" : "medium"} color={isActive ? "white" : "var(--chakra-colors-textPrimary)"}>
                      {item.label}
                    </Text>
                  )}
                </Flex>
              </Tooltip>
            );
          })}
        </VStack>
        
        {/* Theme Switcher at bottom for Desktop */}
        {!isMobile && (
          <Box mt="auto" mb={2}>
            <ThemeSwitcher />
          </Box>
        )}
      </MotionBox>

      {/* Main Content Area */}
      <Box flex={1} position="relative" pt={isMobile ? "calc(52px + env(safe-area-inset-top, 0px))" : 0} overflow="hidden">
        <Outlet />
      </Box>
    </Flex>
  );
};

export default UnifiedWorkspace;
