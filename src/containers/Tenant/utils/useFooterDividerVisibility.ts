import React from 'react';

const SCROLL_THRESHOLD_PX = 1;

function hasHiddenContentBelow(element: HTMLDivElement) {
    const maxScrollTop = element.scrollHeight - element.clientHeight;

    if (maxScrollTop <= SCROLL_THRESHOLD_PX) {
        return false;
    }

    return maxScrollTop - element.scrollTop > SCROLL_THRESHOLD_PX;
}

interface UseFooterDividerVisibilityResult {
    handleScroll: React.UIEventHandler<HTMLDivElement>;
    isFooterDividerVisible: boolean;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    scrollContentRef: React.RefObject<HTMLDivElement>;
}

export function useFooterDividerVisibility(): UseFooterDividerVisibilityResult {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const scrollContentRef = React.useRef<HTMLDivElement>(null);
    const [isFooterDividerVisible, setIsFooterDividerVisible] = React.useState(false);

    const updateFooterDividerVisibility = React.useCallback(() => {
        const scrollContainer = scrollContainerRef.current;

        if (!scrollContainer) {
            setIsFooterDividerVisible(false);
            return;
        }

        setIsFooterDividerVisible(hasHiddenContentBelow(scrollContainer));
    }, []);

    React.useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        const scrollContent = scrollContentRef.current;

        updateFooterDividerVisibility();

        if (!scrollContainer || typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const resizeObserver = new ResizeObserver(() => {
            updateFooterDividerVisibility();
        });

        resizeObserver.observe(scrollContainer);

        if (scrollContent) {
            resizeObserver.observe(scrollContent);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [updateFooterDividerVisibility]);

    const handleScroll = React.useCallback<React.UIEventHandler<HTMLDivElement>>(() => {
        updateFooterDividerVisibility();
    }, [updateFooterDividerVisibility]);

    return {
        handleScroll,
        isFooterDividerVisible,
        scrollContainerRef,
        scrollContentRef,
    };
}
