import React from "react";
import { Icon, type IconName } from "../components/icon";

export interface IconOption {
  id: IconName;
  icon: React.ComponentType<any>;
  label: string;
  category: string;
}

// Generate icon options using our Icon component
const createIconOption = (id: IconName, label: string, category: string): IconOption => ({
  id,
  icon: (props: any) => <Icon name={id} {...props} />,
  label,
  category,
});

export const ICON_OPTIONS: IconOption[] = [
  // Development
  createIconOption('code', 'Code', 'Dev'),
  createIconOption('terminal', 'Terminal', 'Dev'),
  createIconOption('database', 'Database', 'Dev'),
  createIconOption('server', 'Server', 'Dev'),
  createIconOption('cpu', 'CPU', 'Dev'),
  createIconOption('bug', 'Bug Fix', 'Dev'),
  createIconOption('package', 'Package', 'Dev'),
  createIconOption('hash', 'Hash', 'Dev'),
  
  // Web & Mobile
  createIconOption('globe', 'Web', 'Web'),
  createIconOption('smartphone', 'Mobile', 'Web'),
  createIconOption('monitor', 'Desktop', 'Web'),
  createIconOption('tablet', 'Tablet', 'Web'),
  createIconOption('wifi', 'WiFi', 'Web'),
  
  // Design & Media
  createIconOption('palette', 'Design', 'Design'),
  createIconOption('brush', 'Art', 'Design'),
  createIconOption('edit', 'Edit', 'Design'),
  createIconOption('type', 'Typography', 'Design'),
  createIconOption('image', 'Images', 'Design'),
  createIconOption('camera', 'Photo', 'Design'),
  createIconOption('grid', 'Grid', 'Design'),
  createIconOption('maximize', 'Fullscreen', 'Design'),
  
  // Audio & Video
  createIconOption('music', 'Music', 'Media'),
  createIconOption('video', 'Video', 'Media'),
  createIconOption('headphones', 'Audio', 'Media'),
  createIconOption('volume2', 'Volume', 'Media'),
  createIconOption('mic', 'Microphone', 'Media'),
  createIconOption('play', 'Play', 'Media'),
  createIconOption('pause', 'Pause', 'Media'),
  createIconOption('square', 'Stop', 'Media'),
  
  // Business & Finance
  createIconOption('shoppingcart', 'E-commerce', 'Business'),
  createIconOption('creditcard', 'Payments', 'Business'),
  createIconOption('dollarsign', 'Finance', 'Business'),
  createIconOption('trendingup', 'Growth', 'Business'),
  createIconOption('trendingdown', 'Decline', 'Business'),
  createIconOption('piechart', 'Analytics', 'Business'),
  createIconOption('barchart', 'Charts', 'Business'),
  createIconOption('activity', 'Activity', 'Business'),
  createIconOption('briefcase', 'Business', 'Business'),
  createIconOption('tag', 'Tags', 'Business'),
  
  // Communication
  createIconOption('users', 'Team', 'Social'),
  createIconOption('messagecircle', 'Chat', 'Social'),
  createIconOption('mail', 'Email', 'Social'),
  createIconOption('phone', 'Phone', 'Social'),
  
  // Content & Learning
  createIconOption('book', 'Book', 'Content'),
  createIconOption('filetext', 'Document', 'Content'),
  createIconOption('bookmark', 'Bookmark', 'Content'),
  createIconOption('graduationcap', 'Education', 'Content'),
  
  // Places & Buildings
  createIconOption('home', 'Home', 'Places'),
  createIconOption('building', 'Office', 'Places'),
  createIconOption('store', 'Store', 'Places'),
  createIconOption('factory', 'Factory', 'Places'),
  
  // Transportation
  createIconOption('car', 'Car', 'Transport'),
  createIconOption('plane', 'Flight', 'Transport'),
  createIconOption('bike', 'Bike', 'Transport'),
  createIconOption('truck', 'Truck', 'Transport'),
  createIconOption('train', 'Train', 'Transport'),
  
  // Nature & Weather
  createIconOption('sun', 'Weather', 'Nature'),
  createIconOption('moon', 'Night', 'Nature'),
  createIconOption('cloud', 'Cloud', 'Nature'),
  createIconOption('mountain', 'Mountain', 'Nature'),
  createIconOption('flower', 'Nature', 'Nature'),
  
  // Fun & Lifestyle
  createIconOption('heart', 'Love', 'Fun'),
  createIconOption('star', 'Favorite', 'Fun'),
  createIconOption('gift', 'Gift', 'Fun'),
  createIconOption('coffee', 'Coffee', 'Fun'),
  createIconOption('trophy', 'Achievement', 'Fun'),
  createIconOption('gamepad2', 'Gaming', 'Fun'),
  
  // Tools & Settings
  createIconOption('settings', 'Settings', 'Tools'),
  createIconOption('wrench', 'Tools', 'Tools'),
  createIconOption('hammer', 'Build', 'Tools'),
  createIconOption('search', 'Search', 'Tools'),
  createIconOption('filter', 'Filter', 'Tools'),
  createIconOption('list', 'List', 'Tools'),
  
  // Security
  createIconOption('lock', 'Security', 'Security'),
  createIconOption('shield', 'Protection', 'Security'),
  createIconOption('key', 'Access', 'Security'),
  createIconOption('eye', 'View', 'Security'),
  
  // Innovation
  createIconOption('rocket', 'Launch', 'Innovation'),
  createIconOption('target', 'Goal', 'Innovation'),
  createIconOption('flag', 'Flag', 'Innovation'),
  createIconOption('award', 'Award', 'Innovation'),
  createIconOption('sparkles', 'Magic', 'Innovation'),
  createIconOption('flame', 'Hot', 'Innovation'),
  createIconOption('brain', 'AI', 'Innovation'),
  createIconOption('lightbulb', 'Idea', 'Innovation'),
  
  // Utilities
  createIconOption('folder', 'Folder', 'Utility'),
  createIconOption('archive', 'Archive', 'Utility'),
  createIconOption('calculator', 'Calculator', 'Utility'),
  createIconOption('timer', 'Timer', 'Utility'),
  createIconOption('clock', 'Time', 'Utility'),
  createIconOption('calendar', 'Calendar', 'Utility'),
  createIconOption('battery', 'Battery', 'Utility'),
  createIconOption('mappin', 'Location', 'Utility'),
  createIconOption('map', 'Map', 'Utility'),
  createIconOption('compass', 'Navigation', 'Utility'),
];